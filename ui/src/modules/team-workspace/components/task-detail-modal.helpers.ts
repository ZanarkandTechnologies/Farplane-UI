import type { PanelTask } from "./team-panel-types";

export function formatDate(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export function agentIdFromThreadId(threadId: string | undefined): string | null {
  const value = threadId?.trim() ?? "";
  if (!value) return null;
  return `codex-thread:${value}`;
}

export function frontMatterEntries(task: PanelTask): Array<{ label: string; value: string }> {
  const frontMatter = task.frontMatter ?? {};
  return Object.entries(frontMatter)
    .filter(([, value]) => value.trim().length > 0)
    .slice(0, 12)
    .map(([label, value]) => ({ label: label.replace(/_/g, " "), value }));
}

export function stripYamlFrontMatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trimStart();
}
