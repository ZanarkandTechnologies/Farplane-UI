"use client";

/**
 * PROJECT DOCUMENT LIBRARY PANEL
 * ==============================
 * Global office bookshelf panel for browsing Markdown/text docs across project folders.
 *
 * KEY CONCEPTS:
 * - Opens from the office menu or object-bound runtime UI metadata.
 * - Read-only browsing comes first; persistent ingestion/search can layer on this later.
 *
 * USAGE:
 * - Mounted once from OfficeSimulation and driven by app-store panel state.
 */

import { BookOpen, Clipboard, FileText, FolderOpen, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Response } from "@/components/ai-elements/response";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OfficeWorkspaceDialog } from "@/components/office-workspace-dialog";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";
import { type ProjectDocumentRow, useProjectDocumentLibrary } from "./use-project-document-library";

function formatTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function uniqueProjectIds(documents: ProjectDocumentRow[]): string[] {
  return [...new Set(documents.map((document) => document.projectId))];
}

export function ProjectDocumentLibraryContent({ isOpen }: { isOpen: boolean }) {
  const { companyModel } = useOfficeDataContext();
  const projects = companyModel?.projects ?? [];
  const { documents, projectsWithPaths, reload, state } = useProjectDocumentLibrary({
    isOpen,
    projects,
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const visibleDocuments = useMemo(
    () =>
      selectedProjectId === "all"
        ? documents
        : documents.filter((document) => document.projectId === selectedProjectId),
    [documents, selectedProjectId],
  );
  const activeDocument = useMemo(
    () =>
      visibleDocuments.find((document) => document.id === selectedDocumentId) ??
      visibleDocuments[0] ??
      null,
    [selectedDocumentId, visibleDocuments],
  );
  const loadedProjectCount = uniqueProjectIds(documents).length;

  function copyActivePath(): void {
    if (!activeDocument?.absolutePath || typeof navigator === "undefined") return;
    void navigator.clipboard?.writeText(activeDocument.absolutePath);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{documents.length} docs</Badge>
          <Badge variant="outline">{loadedProjectCount} projects loaded</Badge>
          <Badge variant="outline">{projectsWithPaths.length} project folders</Badge>
          {activeDocument ? (
            <Badge variant="outline">Last ingested {formatTime(activeDocument.ingestedAtMs)}</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyActivePath}>
            <Clipboard className="mr-2 h-4 w-4" />
            Copy Path
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reload}
            disabled={state.pending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
          <div className="border-b p-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={selectedProjectId === "all" ? "secondary" : "outline"}
                className="justify-start"
                onClick={() => {
                  setSelectedProjectId("all");
                  setSelectedDocumentId(null);
                }}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                All
              </Button>
              {projectsWithPaths.map((project) => (
                <Button
                  key={project.id}
                  type="button"
                  variant={selectedProjectId === project.id ? "secondary" : "outline"}
                  className="justify-start overflow-hidden"
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setSelectedDocumentId(null);
                  }}
                >
                  <span className="truncate">{project.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {state.error ? (
            <p className="m-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1 p-3">
              {visibleDocuments.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                    activeDocument?.id === document.id
                      ? "border-primary/50 bg-primary/10"
                      : "bg-background hover:bg-muted/60"
                  }`}
                  onClick={() => setSelectedDocumentId(document.id)}
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{document.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {document.projectName} / {document.path}
                    </span>
                  </span>
                </button>
              ))}
              {!state.pending && visibleDocuments.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No documentation files found for this scope.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex min-h-0 flex-col">
          <div className="border-b px-5 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">
                  {activeDocument?.title ?? "Select a document"}
                </h3>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {activeDocument
                    ? `${activeDocument.projectName} / ${activeDocument.path}`
                    : "Open a project document from the bookshelf index."}
                </p>
              </div>
              {activeDocument ? (
                <div className="flex flex-wrap justify-end gap-2 text-xs">
                  <Badge variant="secondary">{activeDocument.collection}</Badge>
                  <Badge variant="outline">Updated {formatTime(activeDocument.updatedAtMs)}</Badge>
                </div>
              ) : null}
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-5">
              {activeDocument ? (
                <Response className="prose prose-sm max-w-none dark:prose-invert text-sm leading-6">
                  {activeDocument.body.trim() || "This document is empty."}
                </Response>
              ) : (
                <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Click a documentation file to preview it.
                </p>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </>
  );
}

export function ProjectDocumentLibraryPanel() {
  const isOpen = useAppStore((state) => state.isDocumentLibraryPanelOpen);
  const setIsOpen = useAppStore((state) => state.setIsDocumentLibraryPanelOpen);

  return (
    <OfficeWorkspaceDialog open={isOpen} onOpenChange={setIsOpen}>
        <div className="border-b px-5 py-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Docs Library
            </DialogTitle>
            <DialogDescription>
              Project documentation gathered from live office project folders.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ProjectDocumentLibraryContent isOpen={isOpen} />
    </OfficeWorkspaceDialog>
  );
}
