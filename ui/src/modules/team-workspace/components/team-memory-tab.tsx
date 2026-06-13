"use client";

/**
 * TEAM MEMORY TAB
 * ===============
 * Read-only active-project memory document viewer for the Team Panel.
 *
 * KEY CONCEPTS:
 * - Canonical team memory lives in each project's deep-init Markdown files, not Convex.
 * - This surface renders the current file corpus while richer document-specific UIs evolve.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "memory" TabsContent.
 *
 * MEMORY REFERENCES:
 * - MEM-0209
 */

import { useMemo, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { describeTeamMemoryAuthor, formatTeamMemoryKindLabel } from "./team-memory-tab.helpers";
import type { TeamMemoryRow } from "./team-panel-types";

interface TeamMemoryTabProps {
  projectId: string | null;
  projectPath: string | null;
  teamId: string | null;
  memoryRows: TeamMemoryRow[];
  composeState: { pending: boolean; error?: string; ok?: string };
  onReloadMemory: () => void;
}

export function TeamMemoryTab({
  projectId,
  projectPath,
  teamId,
  memoryRows,
  composeState,
  onReloadMemory,
}: TeamMemoryTabProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeEntry = useMemo(
    () => memoryRows.find((entry) => entry.id === activeId) ?? memoryRows[0] ?? null,
    [activeId, memoryRows],
  );

  return (
    <div className="grid h-full grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Memory Sources</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onReloadMemory}
              disabled={composeState.pending}
              aria-label="Refresh memory files"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-3rem)] min-h-0 flex-col gap-3 overflow-hidden">
          <div className="space-y-1 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>Project: {projectId ?? "none"}</p>
            <p className="break-all">Path: {projectPath ?? "none"}</p>
            <p>Team: {teamId ?? "none"}</p>
            <p>Files loaded: {memoryRows.length}</p>
          </div>
          {composeState.error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {composeState.error}
            </p>
          ) : null}
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-2 pr-3">
              {memoryRows.map((entry) => (
                <Button
                  key={entry.id}
                  type="button"
                  variant={activeEntry?.id === entry.id ? "secondary" : "outline"}
                  className="h-auto w-full justify-start gap-2 px-3 py-2 text-left"
                  onClick={() => setActiveId(entry.id)}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {entry.title ?? entry.sourcePath ?? entry.id}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.sourcePath ?? entry.id}
                    </span>
                  </span>
                </Button>
              ))}
              {memoryRows.length === 0 && !composeState.pending ? (
                <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  No Farplane memory files were loaded.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-sm">{activeEntry?.title ?? "Memory Document"}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Active project memory rendered from Markdown source files.
              </p>
            </div>
            {activeEntry ? (
              <Badge variant="outline" className="text-[10px] uppercase">
                {formatTeamMemoryKindLabel(activeEntry.kind)}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-3rem)] min-h-0 flex-col overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 rounded-md border p-3">
            <div className="space-y-3">
              {activeEntry ? (
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {formatTeamMemoryKindLabel(activeEntry.kind)}
                    </Badge>
                    <span className="font-medium">{describeTeamMemoryAuthor(activeEntry)}</span>
                    <span className="text-muted-foreground">
                      {new Date(activeEntry.createdAt).toLocaleString()}
                    </span>
                    {activeEntry.sourcePath ? (
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {activeEntry.sourcePath}
                      </Badge>
                    ) : null}
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6">
                    {activeEntry.body.trim() || "This memory file is empty."}
                  </pre>
                </div>
              ) : null}
              {!activeEntry ? (
                <p className="text-sm text-muted-foreground">
                  Select a memory source to inspect its Markdown contents.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
