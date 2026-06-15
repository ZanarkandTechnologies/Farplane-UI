"use client";

/**
 * PROJECT DOCUMENT LIBRARY STATE
 * ==============================
 * Loads lightweight Markdown/text documentation from every live office project path.
 *
 * KEY CONCEPTS:
 * - Uses the existing local state bridge rather than introducing ingestion storage.
 * - Session-only ingestedAtMs gives the UI a future ingestion affordance without persistence claims.
 *
 * USAGE:
 * - Called by ProjectDocumentLibraryPanel when its modal is open.
 */

import { useEffect, useMemo, useState } from "react";
import type { ProjectModel } from "@/modules/runtime";

export type ProjectDocumentRow = {
  id: string;
  projectId: string;
  projectName: string;
  projectPath: string;
  title: string;
  path: string;
  absolutePath?: string;
  body: string;
  updatedAtMs: number;
  ingestedAtMs: number;
  collection: "memory" | "docs";
};

type DocumentLibraryState = {
  error?: string;
  pending: boolean;
};

type FarplaneDocumentPayload = {
  absolutePath?: unknown;
  collection?: unknown;
  content?: unknown;
  exists?: unknown;
  id?: unknown;
  path?: unknown;
  title?: unknown;
  updatedAtMs?: unknown;
};

function projectPath(project: ProjectModel): string {
  return typeof project.trackingContext === "string" ? project.trackingContext.trim() : "";
}

function isLikelyLocalProjectPath(value: string): boolean {
  return value.startsWith("/") || value.startsWith("~/") || /^[A-Za-z]:[\\/]/.test(value);
}

function normalizeDocumentRow(input: {
  ingestedAtMs: number;
  project: ProjectModel;
  projectPath: string;
  row: FarplaneDocumentPayload;
}): ProjectDocumentRow | null {
  const path = typeof input.row.path === "string" ? input.row.path.trim() : "";
  if (!path) return null;
  const body = typeof input.row.content === "string" ? input.row.content : "";
  const exists = input.row.exists !== false && body.trim().length > 0;
  if (!exists) return null;
  const title =
    typeof input.row.title === "string" && input.row.title.trim()
      ? input.row.title.trim()
      : (path.split("/").at(-1) ?? path);
  const collection = input.row.collection === "docs" ? "docs" : "memory";
  return {
    id: `${input.project.id}:${path}`,
    projectId: input.project.id,
    projectName: input.project.name,
    projectPath: input.projectPath,
    title,
    path,
    absolutePath:
      typeof input.row.absolutePath === "string" && input.row.absolutePath.trim()
        ? input.row.absolutePath.trim()
        : undefined,
    body,
    updatedAtMs: typeof input.row.updatedAtMs === "number" ? input.row.updatedAtMs : Date.now(),
    ingestedAtMs: input.ingestedAtMs,
    collection,
  };
}

export function useProjectDocumentLibrary(input: { isOpen: boolean; projects: ProjectModel[] }): {
  documents: ProjectDocumentRow[];
  projectsWithPaths: ProjectModel[];
  reload: () => void;
  state: DocumentLibraryState;
} {
  const [documents, setDocuments] = useState<ProjectDocumentRow[]>([]);
  const [state, setState] = useState<DocumentLibraryState>({ pending: false });
  const [reloadToken, setReloadToken] = useState(0);

  const projectsWithPaths = useMemo(
    () =>
      input.projects
        .filter((project) => {
          const candidatePath = projectPath(project);
          return project.status !== "archived" && isLikelyLocalProjectPath(candidatePath);
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    [input.projects],
  );

  useEffect(() => {
    const loadGeneration = reloadToken;
    if (!input.isOpen) return;
    if (projectsWithPaths.length === 0) {
      setDocuments([]);
      setState({ pending: false, error: "No project folders are available yet." });
      return;
    }

    let cancelled = false;
    setState({ pending: true });
    const ingestedAtMs = Date.now();
    Promise.all(
      projectsWithPaths.map(async (project) => {
        const resolvedProjectPath = projectPath(project);
        const params = new URLSearchParams({ projectPath: resolvedProjectPath });
        try {
          const response = await fetch(`/farplane/memory-files?${params.toString()}`);
          if (!response.ok) throw new Error(`docs_failed:${response.status}`);
          const payload = (await response.json()) as { files?: FarplaneDocumentPayload[] };
          const rows = (payload.files ?? [])
            .map((row) =>
              normalizeDocumentRow({
                ingestedAtMs,
                project,
                projectPath: resolvedProjectPath,
                row,
              }),
            )
            .filter((row): row is ProjectDocumentRow => row !== null);
          return { projectName: project.name, rows };
        } catch (error) {
          return {
            error: `${project.name}: ${error instanceof Error ? error.message : "docs_failed"}`,
            projectName: project.name,
            rows: [] as ProjectDocumentRow[],
          };
        }
      }),
    )
      .then((projectResults) => {
        if (cancelled) return;
        const failures = projectResults
          .map((result) => result.error)
          .filter((error): error is string => Boolean(error));
        setDocuments(
          projectResults
            .flatMap((result) => result.rows)
            .sort(
              (left, right) =>
                left.projectName.localeCompare(right.projectName) ||
                left.path.localeCompare(right.path),
            ),
        );
        void loadGeneration;
        setState({ pending: false, error: failures.length ? failures.join("; ") : undefined });
      })
      .catch((error) => {
        if (cancelled) return;
        setDocuments([]);
        setState({
          pending: false,
          error: error instanceof Error ? error.message : "project_docs_failed",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [input.isOpen, projectsWithPaths, reloadToken]);

  return {
    documents,
    projectsWithPaths,
    reload: () => setReloadToken((current) => current + 1),
    state,
  };
}
