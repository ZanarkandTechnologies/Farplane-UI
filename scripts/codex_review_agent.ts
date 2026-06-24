#!/usr/bin/env tsx
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { Codex } from "@openai/codex-sdk";
import { readFarplaneConfigValue } from "../cli/runtime-config.js";

type ReviewFinding = {
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number | null;
  title: string;
  body: string;
  recommendation: string;
};

type ReviewResult = {
  patch_correct: boolean;
  overall_explanation: string;
  confidence: number;
  findings: ReviewFinding[];
  follow_ups: string[];
};

const root = resolve(process.cwd());
const contextPath = resolve(process.argv[2] ?? ".farplane/reviews/latest/context.md");
const outputPath = resolve(process.argv[3] ?? ".farplane/reviews/latest/review.json");
const markdownPath = outputPath.replace(/\.json$/u, ".md");
const strict = readFarplaneConfigValue("STRICT_AGENT_REVIEW") === "1";
const model = readFarplaneConfigValue("CODEX_REVIEW_MODEL") || undefined;
const timeoutMs = Math.max(30_000, Number(readFarplaneConfigValue("CODEX_REVIEW_TIMEOUT_MS") || 180_000));

const outputSchema = {
  type: "object",
  properties: {
    patch_correct: { type: "boolean" },
    overall_explanation: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          file: { type: "string" },
          line: { type: ["number", "null"] },
          title: { type: "string" },
          body: { type: "string" },
          recommendation: { type: "string" },
        },
        required: ["severity", "file", "line", "title", "body", "recommendation"],
        additionalProperties: false,
      },
    },
    follow_ups: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["patch_correct", "overall_explanation", "confidence", "findings", "follow_ups"],
  additionalProperties: false,
} as const;

function parseReview(text: string): ReviewResult {
  const parsed = JSON.parse(text) as ReviewResult;
  return {
    patch_correct: Boolean(parsed.patch_correct),
    overall_explanation: String(parsed.overall_explanation ?? ""),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0))),
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    follow_ups: Array.isArray(parsed.follow_ups) ? parsed.follow_ups.map(String) : [],
  };
}

function renderMarkdown(result: ReviewResult, threadId: string | null): string {
  const lines = [
    "---",
    `generated: "${new Date().toISOString()}"`,
    `thread_id: "${threadId ?? ""}"`,
    `patch_correct: ${result.patch_correct}`,
    `confidence: ${result.confidence}`,
    "---",
    "",
    "# Codex Agent Review",
    "",
    `Verdict: ${result.patch_correct ? "patch is correct" : "patch needs attention"}`,
    "",
    result.overall_explanation,
    "",
    "## Findings",
    "",
  ];

  if (result.findings.length === 0) {
    lines.push("No actionable findings.");
  } else {
    for (const finding of result.findings) {
      const location = finding.line == null ? finding.file : `${finding.file}:${finding.line}`;
      lines.push(
        `- **${finding.severity.toUpperCase()}** ${location} - ${finding.title}`,
        `  - ${finding.body}`,
        `  - Recommendation: ${finding.recommendation}`,
      );
    }
  }

  lines.push("", "## Follow Ups", "");
  if (result.follow_ups.length === 0) {
    lines.push("None.");
  } else {
    for (const followUp of result.follow_ups) lines.push(`- ${followUp}`);
  }

  return `${lines.join("\n")}\n`;
}

function pickEnv(keys: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of keys) {
    const value = process.env[key];
    if (value != null && value !== "") env[key] = value;
  }
  return env;
}

async function main() {
  const [reviewGuide, codeReviewSkill, reactGuide, context] = await Promise.all([
    readFile(resolve(root, "docs/code_review.md"), "utf8"),
    readOptional(defaultCodeReviewSkillPath()),
    readOptional(defaultReactGuidePath()),
    readFile(contextPath, "utf8"),
  ]);

  const prompt = [
    "You are acting as a read-only pre-push diff reviewer for Farplane UI.",
    "Follow the Farplane code-review skill contract for lightweight local diff review.",
    "Use the Farplane UI review guide as the repo-specific overlay.",
    "Prioritize branch-level maintainability, modularity, consolidation, file placement, documentation, and React guideline drift before ordinary task correctness.",
    "If the diff is too large or truncated, say what remains uncertain in follow_ups.",
    "",
    "## Farplane Code Review Skill Contract",
    codeReviewSkill || "No installed code-review skill found. Run the Farplane install script to link ~/.codex/skills/code-review/SKILL.md.",
    "",
    "## React / Frontend Guideline Contract",
    reactGuide || "No installed vercel-react-best-practices skill found. Ignore this section unless frontend rules are supplied by project docs.",
    "",
    "## Farplane UI Review Guide Overlay",
    reviewGuide,
    "",
    "## Review Context",
    context,
  ].join("\n");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath.replace(/\.json$/u, ".prompt.md"), prompt);

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  const codex = new Codex({
    apiKey: process.env.CODEX_API_KEY ?? process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL,
    env: pickEnv(["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "TEMP", "TMP", "CODEX_HOME"]),
  });
  const thread = codex.startThread({
    workingDirectory: root,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    ...(model ? { model } : {}),
  });
  const turn = await thread.run(prompt, { outputSchema, signal: abortController.signal });
  clearTimeout(timeout);
  const result = parseReview(turn.finalResponse);

  await writeFile(outputPath, `${JSON.stringify({ ...result, thread_id: thread.id }, null, 2)}\n`);
  await writeFile(markdownPath, renderMarkdown(result, thread.id));

  console.log(`Codex agent review written: ${outputPath}`);
  console.log(`Codex agent review markdown: ${markdownPath}`);
  console.log(`Verdict: ${result.patch_correct ? "patch is correct" : "patch needs attention"}`);
  console.log(`Findings: ${result.findings.length}`);

  if (strict && !result.patch_correct) {
    process.exit(1);
  }
}

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

function defaultCodeReviewSkillPath(): string {
  if (process.env.CODEX_REVIEW_SKILL_FILE) return process.env.CODEX_REVIEW_SKILL_FILE;
  if (process.env.CODEX_HOME) return join(process.env.CODEX_HOME, "skills", "code-review", "SKILL.md");
  return join(homedir(), ".codex", "skills", "code-review", "SKILL.md");
}

function defaultReactGuidePath(): string {
  if (process.env.CODEX_REVIEW_REACT_GUIDE_FILE) return process.env.CODEX_REVIEW_REACT_GUIDE_FILE;
  if (process.env.CODEX_HOME) {
    return join(process.env.CODEX_HOME, "skills", "vercel-react-best-practices", "SKILL.md");
  }
  return join(homedir(), ".codex", "skills", "vercel-react-best-practices", "SKILL.md");
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ patch_correct: false, error: message, findings: [] }, null, 2)}\n`,
  );
  console.error("Codex agent review failed.");
  console.error(message);
  if (strict) process.exit(1);
  process.exit(0);
});
