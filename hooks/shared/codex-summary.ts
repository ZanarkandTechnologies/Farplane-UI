/**
 * CODEX SUMMARY RUNNER
 * ====================
 * Ownership: Farplane hook runtime.
 * Inputs: bounded file-change context plus local Codex CLI options.
 * Outputs: one tiny status label or null when local summarization fails.
 * Side effects: spawns `codex exec` and writes a temporary output file.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export type CodexSummaryInput = {
  projectPath: string;
  filePath: string;
  fileContentSnippet: string;
  toolPayloadSnippet?: string;
};

export type CodexSummaryOptions = {
  model?: string;
  timeoutMs?: number;
  runner?: (request: CodexSummaryRunRequest) => Promise<string>;
};

export type CodexSummaryRunRequest = {
  args: string[];
  cwd: string;
  prompt: string;
  timeoutMs: number;
  outputPath: string;
};

const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_FILE_SNIPPET = 5_800;
const MAX_TOOL_SNIPPET = 2_000;
const MAX_SUMMARY_WORDS = 4;
const MAX_SUMMARY_LENGTH = 48;

export function resolveCodexSummaryOptions(env: NodeJS.ProcessEnv = process.env): CodexSummaryOptions {
  return {
    model: env.FARPLANE_FILE_CHANGE_SUMMARY_MODEL || DEFAULT_MODEL,
  };
}

export function buildCodexSummaryPrompt(input: CodexSummaryInput): string {
  return [
    "Summarize this project file change as one tiny employee status bubble label.",
    `File: ${input.filePath}`,
    "Rules:",
    "- Return 2 to 4 words only.",
    "- Max 48 characters.",
    "- Describe the meaningful delta, not the full file path.",
    "- Use Title Case or short sentence case.",
    "- Examples: Progress updated, Goals refined, Ticket proof added, Docs refreshed.",
    "- Do not include secrets, raw diffs, markdown, bullets, quotes, or code fences.",
    "",
    "<file_excerpt>",
    input.fileContentSnippet.slice(0, MAX_FILE_SNIPPET),
    "</file_excerpt>",
    input.toolPayloadSnippet
      ? ["", "<tool_payload_excerpt>", input.toolPayloadSnippet.slice(0, MAX_TOOL_SNIPPET), "</tool_payload_excerpt>"].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function summarizeTrackedFileChangeWithCodex(
  input: CodexSummaryInput,
  options: CodexSummaryOptions = {},
): Promise<string | null> {
  const timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "farplane-codex-summary-"));
  const outputPath = path.join(tempDir, "last-message.txt");
  await writeFile(outputPath, "", "utf8");

  try {
    const args = buildCodexExecArgs({
      projectPath: input.projectPath,
      outputPath,
      model: options.model,
    });
    const prompt = buildCodexSummaryPrompt(input);
    const raw = options.runner
      ? await options.runner({ args, cwd: input.projectPath, prompt, timeoutMs, outputPath })
      : await runCodexExec({ args, cwd: input.projectPath, prompt, timeoutMs, outputPath });
    return normalizeSummary(raw);
  } catch {
    return null;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function buildCodexExecArgs(input: {
  projectPath: string;
  outputPath: string;
  model?: string;
}): string[] {
  const args = ["exec", "--ephemeral", "--cd", input.projectPath, "--output-last-message", input.outputPath];
  if (input.model) args.push("--model", input.model);
  return args;
}

async function runCodexExec(request: CodexSummaryRunRequest): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("codex", request.args, {
        cwd: request.cwd,
        stdio: ["pipe", "ignore", "ignore"],
        signal: controller.signal,
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`codex_summary_failed:${code ?? "signal"}`));
      });
      child.stdin.end(request.prompt);
    });
    return await readFile(request.outputPath, "utf8");
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSummary(value: string): string | null {
  const cleaned = value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\s+/g, " ")
    .replace(/^["'`*_ -]+|["'`*_ -]+$/g, "")
    .replace(/[.!,;:]+$/g, "")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, MAX_SUMMARY_WORDS);
  const label = words.join(" ").slice(0, MAX_SUMMARY_LENGTH).trim();
  return label ? label : null;
}
