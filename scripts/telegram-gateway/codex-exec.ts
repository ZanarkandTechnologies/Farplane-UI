/**
 * Codex exec transport for Telegram-routed messages.
 *
 * Inputs: target Codex session id and prompt text.
 * Outputs: turn ids plus optional assistant response text.
 * Side effects: spawns `codex exec resume` for the target Codex session.
 */

import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import type { CodexTurnItem } from "./types";

type CodexExecSpawn = typeof spawn;

type CodexDeliveryImpl = (input: {
  threadId: string;
  text: string;
  responseTimeoutMs?: number;
}) => Promise<{ turnId?: string; responseText?: string }>;

export async function sendCodexMessage(input: {
  threadId: string;
  text: string;
  responseTimeoutMs?: number;
  codexImpl?: CodexDeliveryImpl;
  codexExecSpawnImpl?: CodexExecSpawn;
}): Promise<{ ok: boolean; turnId?: string; responseText?: string; error?: string }> {
  try {
    const sent = input.codexImpl
      ? await input.codexImpl({
          threadId: input.threadId,
          text: input.text,
          responseTimeoutMs: input.responseTimeoutMs,
        })
      : await sendCodexMessageWithExec({
          threadId: input.threadId,
          text: input.text,
          responseTimeoutMs: input.responseTimeoutMs,
          spawnImpl: input.codexExecSpawnImpl,
        });
    return { ok: true, turnId: sent.turnId, responseText: sent.responseText };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "codex_send_failed" };
  }
}

async function sendCodexMessageWithExec(input: {
  threadId: string;
  text: string;
  responseTimeoutMs?: number;
  spawnImpl?: CodexExecSpawn;
}): Promise<{ turnId?: string; responseText?: string }> {
  const abortController = new AbortController();
  const timeout =
    input.responseTimeoutMs && input.responseTimeoutMs > 0
      ? setTimeout(() => abortController.abort(), input.responseTimeoutMs)
      : undefined;
  try {
    return await runCodexExecResume({
      threadId: input.threadId,
      text: input.text,
      signal: abortController.signal,
      spawnImpl: input.spawnImpl ?? spawn,
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function runCodexExecResume(input: {
  threadId: string;
  text: string;
  signal: AbortSignal;
  spawnImpl: CodexExecSpawn;
}): Promise<{ turnId?: string; responseText?: string }> {
  const command = process.env.CODEX_CLI_PATH || "codex";
  const args = [
    "exec",
    "--experimental-json",
    "--sandbox",
    "danger-full-access",
    "--config",
    'approval_policy="never"',
  ];
  if (process.env.OPENAI_BASE_URL) {
    args.push("--config", `openai_base_url=${JSON.stringify(process.env.OPENAI_BASE_URL)}`);
  }
  args.push("resume", input.threadId);

  const env = { ...process.env };
  if (!env.CODEX_API_KEY && env.OPENAI_API_KEY) {
    env.CODEX_API_KEY = env.OPENAI_API_KEY;
  }

  const child = input.spawnImpl(command, args, {
    env,
    signal: input.signal,
  }) as ChildProcessWithoutNullStreams;

  let stdoutBuffer = "";
  let stderr = "";
  let finalResponse = "";
  let turnFailure: string | undefined;
  let parseError: Error | undefined;

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    if (parseError) return;
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/u);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: ReturnType<typeof parseCodexExecEvent>;
      try {
        event = parseCodexExecEvent(line);
      } catch (error) {
        parseError = error instanceof Error ? error : new Error("codex_exec_invalid_json");
        return;
      }
      if (event.type === "item.completed") {
        const text = extractCodexExecAgentMessageText(event.item);
        if (text) finalResponse = text;
      } else if (event.type === "turn.failed") {
        turnFailure = event.error?.message || "codex_exec_turn_failed";
      }
    }
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  if (child.stdin.writable) {
    child.stdin.write(input.text);
    child.stdin.end();
  }

  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (parseError) {
        reject(parseError);
        return;
      }
      if (stdoutBuffer.trim()) {
        try {
          const event = parseCodexExecEvent(stdoutBuffer);
          if (event.type === "item.completed") {
            const text = extractCodexExecAgentMessageText(event.item);
            if (text) finalResponse = text;
          } else if (event.type === "turn.failed") {
            turnFailure = event.error?.message || "codex_exec_turn_failed";
          }
        } catch (error) {
          reject(error);
          return;
        }
      }
      if (turnFailure) {
        reject(new Error(turnFailure));
        return;
      }
      if (code !== 0 || signal) {
        const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
        reject(new Error(`Codex Exec exited with ${detail}: ${stderr.trim()}`.trim()));
        return;
      }
      resolve();
    });
  });

  return { turnId: input.threadId, responseText: finalResponse.trim() || undefined };
}

function parseCodexExecEvent(line: string): {
  type?: string;
  item?: CodexTurnItem;
  error?: { message?: string };
} {
  try {
    return JSON.parse(line) as {
      type?: string;
      item?: CodexTurnItem;
      error?: { message?: string };
    };
  } catch (error) {
    throw new Error(`codex_exec_invalid_json:${line}`, { cause: error });
  }
}

function extractCodexExecAgentMessageText(item: CodexTurnItem | undefined): string | undefined {
  if (item?.type !== "agent_message" && item?.type !== "agentMessage") return undefined;
  const directText = item.text?.trim();
  if (directText) return directText;
  const contentText = item.content
    ?.map((part) => part.text)
    .filter((text): text is string => Boolean(text?.trim()))
    .join("\n")
    .trim();
  if (contentText) return contentText;
  return undefined;
}
