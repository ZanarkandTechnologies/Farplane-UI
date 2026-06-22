/**
 * CODEX SUMMARY RUNNER
 * ====================
 * Ownership: Farplane hook runtime.
 * Inputs: bounded file-change context plus local Codex CLI options.
 * Outputs: one short status sentence or null when local summarization fails.
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
  executable?: string;
  model?: string;
  useOss?: boolean;
  localProvider?: "lmstudio" | "ollama" | string;
  timeoutMs?: number;
  runner?: (request: CodexSummaryRunRequest) => Promise<string>;
};

export type CodexSummaryRunRequest = {
  executable: string;
  args: string[];
  cwd: string;
  prompt: string;
  timeoutMs: number;
  outputPath: string;
};

const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_FILE_SNIPPET = 6_000;
const MAX_TOOL_SNIPPET = 2_000;
const MAX_SUMMARY_LENGTH = 160;

export function resolveCodexSummaryOptions(env: NodeJS.ProcessEnv = process.env): CodexSummaryOptions {
  return {
    executable: env.FARPLANE_CODEX_EXECUTABLE || "codex",
    model: env.FARPLANE_FILE_CHANGE_SUMMARY_MODEL || DEFAULT_MODEL,
    useOss: env.FARPLANE_FILE_CHANGE_SUMMARY_OSS === "1",
    localProvider: env.FARPLANE_FILE_CHANGE_SUMMARY_LOCAL_PROVIDER,
    timeoutMs: parsePositiveInt(env.FARPLANE_FILE_CHANGE_SUMMARY_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS,
  };
}

export function buildCodexSummaryPrompt(input: CodexSummaryInput): string {
  return [
    "Summarize this project file change as one concise employee status bubble.",
    `File: ${input.filePath}`,
    "Rules:",
    "- Return exactly one sentence.",
    "- Max 140 characters.",
    "- Mention the artifact and meaningful delta.",
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
  const executable = options.executable || "codex";
  const timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "farplane-codex-summary-"));
  const outputPath = path.join(tempDir, "last-message.txt");
  await writeFile(outputPath, "", "utf8");

  try {
    const args = buildCodexExecArgs({
      projectPath: input.projectPath,
      outputPath,
      model: options.model,
      useOss: options.useOss,
      localProvider: options.localProvider,
    });
    const prompt = buildCodexSummaryPrompt(input);
    const raw = options.runner
      ? await options.runner({ executable, args, cwd: input.projectPath, prompt, timeoutMs, outputPath })
      : await runCodexExec({ executable, args, cwd: input.projectPath, prompt, timeoutMs, outputPath });
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
  useOss?: boolean;
  localProvider?: string;
}): string[] {
  const args = ["exec", "--ephemeral", "--cd", input.projectPath, "--output-last-message", input.outputPath];
  if (input.useOss) args.push("--oss");
  if (input.localProvider) args.push("--local-provider", input.localProvider);
  if (input.model && !input.useOss) args.push("--model", input.model);
  return args;
}

async function runCodexExec(request: CodexSummaryRunRequest): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(request.executable, request.args, {
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
    .trim()
    .slice(0, MAX_SUMMARY_LENGTH);
  return cleaned ? cleaned : null;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
