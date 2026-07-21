"use client";

import { type ReactElement, useMemo } from "react";
import { Response } from "@/components/ai-elements/response";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkillStudioFileEntry } from "@/modules/runtime";
import { stripMarkdownFrontmatter } from "./skill-markdown";
import type { SkillDoc } from "./skill-os-types";
import type { SkillWorkbenchModel } from "./skill-workbench-model";
import { useSkillFileContent } from "./use-skill-file-content";

function RunbookSection({
  children,
  empty,
  meta,
  title,
}: {
  children: string;
  empty: string;
  meta?: string;
  title: string;
}): ReactElement {
  return (
    <section className="min-w-0 overflow-hidden border-t pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="[font-family:Inter,sans-serif] text-sm font-semibold">{title}</h4>
        {meta ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </div>
      {children.trim() ? (
        <Response className="prose prose-invert mt-4 max-w-none break-words [font-family:Inter,sans-serif] text-sm leading-6 [&_code]:font-mono [&_input[type=checkbox]]:mr-2 [&_li]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:font-mono">
          {children}
        </Response>
      ) : (
        <p className="mt-3 [font-family:Inter,sans-serif] text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function checklistProgress(markdown: string): { done: number; total: number } {
  const items = [...markdown.matchAll(/^\s*[-*+]\s+\[([ xX])\]\s+/gm)];
  return {
    done: items.filter((item) => item[1]?.toLowerCase() === "x").length,
    total: items.length,
  };
}

function declaredChecklistPath(doc: SkillDoc | null, fileEntries: SkillStudioFileEntry[]): string {
  const declared = doc?.frontmatter?.qa_checklist;
  if (typeof declared !== "string" || !declared.trim()) return "";
  const normalized = declared.replace(/^\.\//, "");
  return (
    fileEntries.find((entry) => entry.isText && entry.path.replace(/^\.\//, "") === normalized)
      ?.path ?? ""
  );
}

export function SkillRunbookPanel({
  doc,
  fileEntries,
  model,
  skillId,
}: {
  doc: SkillDoc | null;
  fileEntries: SkillStudioFileEntry[];
  model: SkillWorkbenchModel;
  skillId: string;
}): ReactElement {
  const checklistPath = useMemo(() => declaredChecklistPath(doc, fileEntries), [doc, fileEntries]);
  const checklist = useSkillFileContent(skillId, checklistPath);
  const declared =
    typeof doc?.frontmatter?.qa_checklist === "string" ? doc.frontmatter.qa_checklist : "";
  const stepProgress = checklistProgress(model.todo);
  const qualityProgress = checklistProgress(checklist.content);

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
      <RunbookSection
        title="Steps"
        meta={stepProgress.total ? `${stepProgress.total} steps` : undefined}
        empty="No Todo List is defined in SKILL.md."
      >
        {model.todo}
      </RunbookSection>
      <div className="min-w-0 grid gap-7">
        <section className="min-w-0 overflow-hidden border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="[font-family:Inter,sans-serif] text-sm font-semibold">Quality checks</h4>
            <span className="font-mono text-[10px] text-muted-foreground">
              {qualityProgress.total
                ? `${qualityProgress.done} / ${qualityProgress.total}`
                : declared || "not declared"}
            </span>
          </div>
          {checklist.status === "loading" ? <Skeleton className="mt-3 h-40 w-full" /> : null}
          {checklist.status === "ready" ? (
            <Response className="prose prose-invert mt-4 max-w-none break-words [font-family:Inter,sans-serif] text-sm leading-6 [&_code]:font-mono [&_input[type=checkbox]]:mr-2 [&_li]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:font-mono">
              {stripMarkdownFrontmatter(checklist.content)}
            </Response>
          ) : null}
          {checklist.status === "error" ? (
            <p className="mt-3 text-sm text-destructive">{checklist.error}</p>
          ) : null}
          {checklist.status === "idle" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {declared
                ? "The declared checklist is not present in this skill's file inventory."
                : "No qa_checklist file is declared."}
            </p>
          ) : null}
        </section>
        {model.qaTasks.trim() ? (
          <RunbookSection title="QA tasks" meta="explicit" empty="">
            {model.qaTasks}
          </RunbookSection>
        ) : null}
      </div>
    </div>
  );
}
