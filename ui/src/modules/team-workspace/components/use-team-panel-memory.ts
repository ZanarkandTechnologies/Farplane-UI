"use client";

/**
 * TEAM PANEL MEMORY STATE
 * =======================
 * Purpose
 * - Encapsulate Farplane project memory document loading for the Team Panel.
 *
 * KEY CONCEPTS:
 * - Canonical team memory lives in repository Markdown files, not Convex.
 * - This hook shapes those files into display rows while richer document UIs evolve.
 *
 * USAGE:
 * - Call from TeamPanel with the resolved project/team scope.
 *
 * MEMORY REFERENCES:
 * - MEM-0209
 */

import { useEffect, useMemo, useState } from "react";
import type { TeamMemoryRow } from "./team-panel-types";

interface UseTeamPanelMemoryStateInput {
  activeProjectId: string | undefined;
}

interface MemoryComposeState {
  pending: boolean;
  error?: string;
  ok?: string;
}

interface FarplaneMemoryFilePayload {
  id?: unknown;
  title?: unknown;
  kind?: unknown;
  path?: unknown;
  content?: unknown;
  updatedAtMs?: unknown;
}

function toMemoryRow(row: FarplaneMemoryFilePayload): TeamMemoryRow | null {
  const path = typeof row.path === "string" ? row.path : "";
  const content = typeof row.content === "string" ? row.content : "";
  if (!path) return null;
  const title = typeof row.title === "string" && row.title.trim() ? row.title.trim() : path;
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : path;
  const updatedAtMs = typeof row.updatedAtMs === "number" ? row.updatedAtMs : Date.now();
  return {
    id,
    projectId: "farplane",
    authorType: "system",
    kind: "document",
    body: content,
    createdAt: updatedAtMs,
    sourcePath: path,
    title,
  };
}

export function useTeamPanelMemoryState({
  activeProjectId,
}: UseTeamPanelMemoryStateInput): {
  memoryRows: TeamMemoryRow[];
  composeState: MemoryComposeState;
  reloadMemory: () => void;
} {
  const [memoryRows, setMemoryRows] = useState<TeamMemoryRow[]>([]);
  const [composeState, setComposeState] = useState<MemoryComposeState>({ pending: false });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!activeProjectId) {
      setMemoryRows([]);
      setComposeState({ pending: false });
      return;
    }
    let cancelled = false;
    setComposeState({ pending: true });
    fetch("/farplane/memory-files")
      .then((response) => {
        if (!response.ok) throw new Error(`memory_files_failed:${response.status}`);
        return response.json() as Promise<{ files?: FarplaneMemoryFilePayload[] }>;
      })
      .then((payload) => {
        if (cancelled) return;
        const rows = Array.isArray(payload.files)
          ? payload.files.map(toMemoryRow).filter((row): row is TeamMemoryRow => row !== null)
          : [];
        setMemoryRows(rows);
        setComposeState({ pending: false });
      })
      .catch((error) => {
        if (cancelled) return;
        setMemoryRows([]);
        setComposeState({
          pending: false,
          error: error instanceof Error ? error.message : "memory_files_failed",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, reloadToken]);

  const sortedRows = useMemo(
    () => [...memoryRows].sort((left, right) => left.id.localeCompare(right.id)),
    [memoryRows],
  );

  return {
    memoryRows: sortedRows,
    composeState,
    reloadMemory: () => setReloadToken((current) => current + 1),
  };
}
