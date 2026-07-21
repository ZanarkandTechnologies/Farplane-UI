/**
 * Ownership: Skill OS read-only projection of skill-local self-improvement memory.
 * Inputs: canonical self-improve/program.md and progress.md Markdown.
 * Outputs: compact plan fields, chronological entries, and normalized plot scores.
 * Side effects: none. Missing or partial fields stay visible instead of being invented.
 */

const HEADING_PATTERN = /^##\s+(.+?)\s*$/gm;
const FIELD_PATTERN = /^\s*-\s+(?:`([^`]+)`|([^:]+)):\s*(.*)$/;
const SCORE_FIELD_PRIORITY = [
  "candidate metric",
  "primary metric",
  "score",
  "grade",
  "result",
] as const;

export type SelfImprovePlan = {
  objective: string;
  primaryMetric: string;
  direction: string;
  stopRule: string;
};

export type SelfImproveScore = {
  display: string;
  normalized: number;
  sourceField: string;
};

export type SelfImproveProgressEntry = {
  id: string;
  heading: string;
  date: string;
  title: string;
  fields: Array<{ label: string; value: string }>;
  insight: string;
  decision: string;
  score: SelfImproveScore | undefined;
};

export type SelfImproveProjection = {
  plan: SelfImprovePlan;
  entries: SelfImproveProgressEntry[];
};

function cleanMarkdown(value: string): string {
  return value
    .replace(/^---[\s\S]*?---\s*/, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function readSection(markdown: string, matcher: RegExp): string {
  const headings = [...markdown.matchAll(HEADING_PATTERN)];
  const matchIndex = headings.findIndex((match) => matcher.test(match[1] ?? ""));
  if (matchIndex < 0) return "";
  const match = headings[matchIndex];
  const start = (match.index ?? 0) + match[0].length;
  const end = headings[matchIndex + 1]?.index ?? markdown.length;
  return cleanMarkdown(markdown.slice(start, end));
}

function firstParagraph(value: string): string {
  return (
    value
      .split(/\n\s*\n/)
      .map((part) =>
        part
          .replace(/^\s*-\s+/, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .find(Boolean) ?? ""
  );
}

function readBulletValue(section: string, label: RegExp): string {
  for (const line of section.split(/\r?\n/)) {
    const match = line.match(FIELD_PATTERN);
    const key = (match?.[1] ?? match?.[2] ?? "").trim();
    if (match && label.test(key)) return cleanMarkdown(match[3] ?? "");
  }
  return "";
}

export function parseSelfImprovePlan(markdown: string): SelfImprovePlan {
  const objectiveSection = readSection(markdown, /^objective$/i);
  const metricSection = readSection(markdown, /^(?:eval\s+)?metric$/i);
  const stopSection = readSection(markdown, /^stop rule$/i);
  return {
    objective: firstParagraph(objectiveSection),
    primaryMetric: readBulletValue(metricSection, /^primary$/i),
    direction: readBulletValue(metricSection, /^direction$/i),
    stopRule: stopSection
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*-\s+/, "").trim())
      .filter(Boolean)
      .join(" · "),
  };
}

function parseFields(body: string): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [];
  let active: { label: string; value: string } | null = null;
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(FIELD_PATTERN);
    if (match) {
      active = {
        label: (match[1] ?? match[2] ?? "Field").trim(),
        value: cleanMarkdown(match[3] ?? ""),
      };
      fields.push(active);
      continue;
    }
    const continuation = line.trim();
    if (
      active &&
      continuation &&
      !continuation.startsWith("```") &&
      !continuation.startsWith("#")
    ) {
      active.value = `${active.value} ${cleanMarkdown(continuation)}`.trim();
    }
  }
  return fields;
}

function fieldValue(fields: SelfImproveProgressEntry["fields"], matcher: RegExp): string {
  return fields.find((field) => matcher.test(field.label))?.value ?? "";
}

const GRADE_SCORES: Record<string, number> = {
  "A+": 100,
  A: 96,
  "A-": 92,
  "B+": 88,
  B: 84,
  "B-": 80,
  "C+": 76,
  C: 72,
  "C-": 68,
  D: 58,
  F: 35,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function parseScoreValue(value: string, sourceField: string): SelfImproveScore | undefined {
  const percentages = [...value.matchAll(/(-?\d+(?:\.\d+)?)\s*%/g)];
  const percentage = percentages.at(-1)?.[1];
  if (percentage !== undefined) {
    const normalized = clampScore(Number(percentage));
    return { display: `${Number(percentage).toLocaleString()}%`, normalized, sourceField };
  }

  const gradeMatch = /grade/i.test(sourceField)
    ? value.match(/(?:^|[\s:=;(])(A\+|A-|A|B\+|B-|B|C\+|C-|C|D|F)(?:$|[\s,;).])/i)
    : value.match(/\bgrade\s*[=:]?\s*(A\+|A-|A|B\+|B-|B|C\+|C-|C|D|F)\b/i);
  const grade = gradeMatch?.[1]?.toUpperCase();
  if (grade && GRADE_SCORES[grade] !== undefined) {
    return { display: grade, normalized: GRADE_SCORES[grade], sourceField };
  }

  const namedDecimals = [
    ...value.matchAll(/(?:pass[_\s-]?rate|score|metric)\s*[=:]\s*(\d+(?:\.\d+)?)/gi),
  ];
  const namedDecimal = namedDecimals.at(-1)?.[1];
  if (namedDecimal !== undefined) {
    const raw = Number(namedDecimal);
    const normalized = clampScore(raw <= 1 ? raw * 100 : raw);
    return {
      display: raw <= 1 ? `${Math.round(normalized * 10) / 10}%` : String(raw),
      normalized,
      sourceField,
    };
  }

  const ratios = [...value.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g)];
  const ratio = ratios.at(-1);
  if (ratio) {
    const denominator = Number(ratio[2]);
    if (denominator > 0) {
      const normalized = clampScore((Number(ratio[1]) / denominator) * 100);
      return {
        display: `${Math.round(normalized * 10) / 10}%`,
        normalized,
        sourceField,
      };
    }
  }

  if (/^(?:candidate metric|primary metric|score|grade)$/i.test(sourceField)) {
    const bareNumber = value.match(/-?\d+(?:\.\d+)?/)?.[0];
    if (bareNumber !== undefined) {
      const raw = Number(bareNumber);
      const normalized = clampScore(raw <= 1 ? raw * 100 : raw);
      return {
        display: raw <= 1 ? `${Math.round(normalized * 10) / 10}%` : String(raw),
        normalized,
        sourceField,
      };
    }
  }

  return undefined;
}

function deriveScore(fields: SelfImproveProgressEntry["fields"]): SelfImproveScore | undefined {
  for (const key of SCORE_FIELD_PRIORITY) {
    const field = fields.find((candidate) => candidate.label.trim().toLowerCase() === key);
    if (!field || /^(?:pending|none|n\/a)$/i.test(field.value.trim())) continue;
    const score = parseScoreValue(field.value, field.label);
    if (score) return score;
  }
  return undefined;
}

function parseHeading(heading: string): { date: string; title: string } {
  const parts = heading.split(/\s+[—–-]\s+/, 2);
  if (parts.length === 1) return { date: "", title: heading.trim() };
  return { date: parts[0]?.trim() ?? "", title: parts[1]?.trim() ?? heading.trim() };
}

export function parseSelfImproveProgress(markdown: string): SelfImproveProgressEntry[] {
  const headings = [...markdown.matchAll(HEADING_PATTERN)];
  return headings
    .map((match, index) => {
      const heading = (match[1] ?? "").trim();
      if (/^(?:review|entry template|completion entry template)$/i.test(heading)) return null;
      const start = (match.index ?? 0) + match[0].length;
      const end = headings[index + 1]?.index ?? markdown.length;
      const fields = parseFields(markdown.slice(start, end));
      if (fields.length === 0) return null;
      const { date, title } = parseHeading(heading);
      const insight =
        fieldValue(fields, /^learning$/i) ||
        fieldValue(fields, /^hypothesis$/i) ||
        fieldValue(fields, /^result$/i) ||
        title;
      const decision = fieldValue(fields, /^decision$/i);
      return {
        id: `${date || "entry"}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
        heading,
        date,
        title,
        fields,
        insight,
        decision,
        score: deriveScore(fields),
      } satisfies SelfImproveProgressEntry;
    })
    .filter((entry): entry is SelfImproveProgressEntry => entry !== null);
}

export function buildSelfImproveProjection(
  programMarkdown: string,
  progressMarkdown: string,
): SelfImproveProjection {
  return {
    plan: parseSelfImprovePlan(programMarkdown),
    entries: parseSelfImproveProgress(progressMarkdown),
  };
}

export function hasSelfImproveDirectory(paths: Array<{ path: string }>): boolean {
  return paths.some((entry) => entry.path.startsWith("self-improve/"));
}
