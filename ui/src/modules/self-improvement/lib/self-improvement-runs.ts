/**
 * Ownership: pure projection of ticket-backed self-improvement Goal Packets.
 * Inputs: ticket/program/progress Markdown from the bounded local bridge.
 * Outputs: sortable run summaries containing only explicitly recorded facts.
 * Side effects: none; missing scores, phases, evidence, and targets remain absent.
 */

export type SelfImprovementRunPacket = {
  projectId: string;
  projectName: string;
  ticketId: string;
  ticketTitle: string;
  ticketUpdatedAt: number;
  ticketMarkdown: string;
  programMarkdown: string;
  progressMarkdown: string;
};

export type SelfImproveRunSummary = {
  id: string;
  projectId: string;
  projectName: string;
  ticketId: string;
  title: string;
  targetSkill?: string;
  status?: string;
  phase?: string;
  updatedAt?: string;
  nextAction?: string;
  baselineScore?: string;
  currentScore?: string;
  targetScore?: string;
  scoreDelta?: string;
  evidenceRefs: string[];
};

type ProgressEntry = {
  heading: string;
  fields: Map<string, string>;
};

function frontMatter(markdown: string): Map<string, string> {
  const values = new Map<string, string>();
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
  if (!match) return values;
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (field) values.set(field[1].toLowerCase(), field[2].replace(/^["']|["']$/g, ""));
  }
  return values;
}

function normalizedField(label: string): string {
  return label
    .replace(/`/g, "")
    .replace(/:\s*$/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function progressEntries(markdown: string): ProgressEntry[] {
  const headings = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)];
  return headings.map((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    const fields = new Map<string, string>();
    for (const line of markdown.slice(start, end).split(/\r?\n/)) {
      const match = line.match(/^\s*-\s+(?:`([^`]+)`|([^:]+):)\s*(.*?)\s*$/);
      if (match) fields.set(normalizedField(match[1] ?? match[2] ?? ""), match[3].trim());
    }
    return { heading: heading[1].trim(), fields };
  });
}

function firstField(
  sources: Array<Map<string, string>>,
  names: readonly string[],
): string | undefined {
  for (const source of sources) {
    for (const name of names) {
      const value = source.get(name)?.trim();
      if (value) return value;
    }
  }
  return undefined;
}

function targetSkill(packet: SelfImprovementRunPacket): string | undefined {
  const ticketTarget = packet.ticketMarkdown.match(
    /^\s*target_skill:\s*["']?([^\n"']+)["']?\s*$/im,
  )?.[1];
  if (ticketTarget?.trim()) return ticketTarget.trim();
  const heading = packet.programMarkdown.match(/^#\s+Self-Improve:\s+([^\n]+?)\s*$/im)?.[1];
  if (heading?.trim()) return heading.trim();
  const targetPath = packet.programMarkdown.match(
    /^\s*-\s+.*?skills\/([^/\s]+)\/SKILL\.md\s*$/im,
  )?.[1];
  if (targetPath?.trim()) return targetPath.trim();
  const runtimeSkill = packet.programMarkdown.match(
    /^\s*-\s*Runtime skill:\s*`?[^`\n]*?skills\/([^/`\s]+)\/?`?\.?\s*$/im,
  )?.[1];
  return runtimeSkill?.trim() || undefined;
}

function explicitUpdatedAt(
  packet: SelfImprovementRunPacket,
  latest: ProgressEntry | undefined,
): string | undefined {
  const progressValue = firstField(latest ? [latest.fields] : [], ["updated_at", "evaluated_at"]);
  if (progressValue) return progressValue;
  const headingDate = latest?.heading.match(/^(\d{4}-\d{2}-\d{2}(?:[ T][0-9:+-]+)?)/)?.[1];
  if (headingDate) return headingDate;
  const ticketValue = frontMatter(packet.ticketMarkdown).get("updated_at")?.trim();
  if (ticketValue) return ticketValue;
  return packet.ticketUpdatedAt > 0 ? new Date(packet.ticketUpdatedAt).toISOString() : undefined;
}

function evidenceRefs(value: string | undefined): string[] {
  if (!value) return [];
  const backticks = [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
  const candidates = backticks.length > 0 ? backticks : value.split(/\s*;\s*|\s*,\s*/);
  return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
}

export function parseSelfImproveRun(packet: SelfImprovementRunPacket): SelfImproveRunSummary {
  const ticketFields = frontMatter(packet.ticketMarkdown);
  const programFields = frontMatter(packet.programMarkdown);
  const entries = progressEntries(packet.progressMarkdown);
  const latest = entries.at(-1);
  const latestSources = latest ? [latest.fields] : [];
  const target = targetSkill(packet);
  const status = firstField([programFields, ticketFields], ["status"]);
  const phase = firstField([...latestSources, programFields, ticketFields], ["phase"]);
  const updatedAt = explicitUpdatedAt(packet, latest);
  const nextAction = firstField([...latestSources, ticketFields], ["next_action"]);
  const baselineScore = firstField(latestSources, ["baseline_score", "baseline_metric"]);
  const currentScore = firstField(latestSources, ["current_score", "candidate_score", "score"]);
  const targetScore = firstField([...latestSources, programFields, ticketFields], ["target_score"]);
  const scoreDelta = firstField(latestSources, ["score_delta", "delta"]);
  return {
    id: `${packet.projectId}:${packet.ticketId}`,
    projectId: packet.projectId,
    projectName: packet.projectName,
    ticketId: packet.ticketId,
    title: packet.ticketTitle || packet.ticketId,
    ...(target ? { targetSkill: target } : {}),
    ...(status ? { status } : {}),
    ...(phase ? { phase } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(nextAction ? { nextAction } : {}),
    ...(baselineScore ? { baselineScore } : {}),
    ...(currentScore ? { currentScore } : {}),
    ...(targetScore ? { targetScore } : {}),
    ...(scoreDelta ? { scoreDelta } : {}),
    evidenceRefs: evidenceRefs(firstField(latestSources, ["evidence", "evidence_refs"])),
  };
}

function updatedAtMs(run: SelfImproveRunSummary): number {
  if (!run.updatedAt) return 0;
  const parsed = Date.parse(run.updatedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildSelfImproveRunSummaries(
  packets: readonly SelfImprovementRunPacket[],
): SelfImproveRunSummary[] {
  return packets
    .map(parseSelfImproveRun)
    .sort(
      (left, right) =>
        updatedAtMs(right) - updatedAtMs(left) ||
        left.projectName.localeCompare(right.projectName) ||
        left.ticketId.localeCompare(right.ticketId),
    );
}
