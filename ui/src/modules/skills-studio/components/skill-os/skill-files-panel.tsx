"use client";

import { FileCode2 } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Response } from "@/components/ai-elements/response";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkillStudioFileEntry } from "@/modules/runtime";
import { stripMarkdownFrontmatter } from "./skill-markdown";
import { useSkillFileContent } from "./use-skill-file-content";

function isMarkdown(path: string): boolean {
  return /\.mdx?$/i.test(path);
}

export function SkillFilesPanel({
  fallbackSkillMarkdown,
  fileEntries,
  skillId,
}: {
  fallbackSkillMarkdown: string;
  fileEntries: SkillStudioFileEntry[];
  skillId: string;
}): ReactElement {
  const textFiles = useMemo(
    () =>
      fileEntries
        .filter((entry) => entry.isText)
        .slice()
        .sort((a, b) => a.path.localeCompare(b.path)),
    [fileEntries],
  );
  const defaultPath =
    textFiles.find((entry) => entry.path === "SKILL.md")?.path ?? textFiles[0]?.path ?? "SKILL.md";
  const [selectedPath, setSelectedPath] = useState(defaultPath);
  const [mode, setMode] = useState<"rendered" | "raw">("rendered");
  const selectedExists = textFiles.some((entry) => entry.path === selectedPath);
  const fileState = useSkillFileContent(skillId, selectedExists ? selectedPath : "");
  const content = selectedExists
    ? fileState.content
    : selectedPath === "SKILL.md"
      ? fallbackSkillMarkdown
      : "";

  useEffect(() => {
    if (!textFiles.some((entry) => entry.path === selectedPath)) setSelectedPath(defaultPath);
  }, [defaultPath, selectedPath, textFiles]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav className="border-y py-2" aria-label="Skill files">
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Files
        </p>
        <div className="mt-1 grid gap-1">
          {(textFiles.length > 0
            ? textFiles
            : [{ path: "SKILL.md", kind: "skill" as const, isText: true }]
          ).map((entry) => (
            <button
              key={entry.path}
              type="button"
              className={`flex min-h-11 min-w-0 touch-manipulation items-center gap-2 border-l-2 px-2 py-2 text-left text-xs hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selectedPath === entry.path ? "border-primary bg-primary/[0.06] text-foreground" : "border-transparent text-muted-foreground"}`}
              onClick={() => setSelectedPath(entry.path)}
            >
              <FileCode2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-all">{entry.path}</span>
            </button>
          ))}
        </div>
      </nav>

      <section className="min-w-0 overflow-hidden border-y bg-card/20">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <p className="min-w-0 break-all font-mono text-xs">{selectedPath}</p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={mode === "rendered" ? "secondary" : "ghost"}
              onClick={() => setMode("rendered")}
              disabled={!isMarkdown(selectedPath)}
            >
              Rendered
            </Button>
            <Button
              size="sm"
              variant={mode === "raw" ? "secondary" : "ghost"}
              onClick={() => setMode("raw")}
            >
              Raw
            </Button>
          </div>
        </header>
        <div className="p-4">
          {fileState.status === "loading" ? <Skeleton className="h-56 w-full" /> : null}
          {fileState.status === "error" ? (
            <p className="text-sm text-destructive">{fileState.error}</p>
          ) : null}
          {fileState.status !== "loading" && fileState.status !== "error" ? (
            mode === "rendered" && isMarkdown(selectedPath) ? (
              <Response className="prose prose-invert max-w-none text-sm">
                {stripMarkdownFrontmatter(content)}
              </Response>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-muted-foreground">
                {content || "This file is empty."}
              </pre>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
