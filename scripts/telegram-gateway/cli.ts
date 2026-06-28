/**
 * CLI loop for the local Telegram gateway.
 *
 * Inputs: command-line flags, resolved config, Telegram updates, and local
 * gateway state.
 * Outputs: JSON status lines for polling, queueing, and delivery results.
 * Side effects: long-polls Telegram, routes messages to Codex, and writes state.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { defaultConfigPath, resolveGatewayConfig } from "./config";
import { processPendingMessages, processTelegramUpdate } from "./processor";
import {
  defaultStatePath,
  loadGatewayState,
  mergeGatewayState,
  saveGatewayState,
} from "./state";
import { fetchTelegramUpdates, sendTelegramDocument, sendTelegramNotification } from "./telegram-api";
import type { TelegramUpdate } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function defaultLockPath(statePath = defaultStatePath()): string {
  return path.join(path.dirname(statePath), "gateway.pid");
}

function argValue(rawArgs: string[], flag: string): string | undefined {
  const index = rawArgs.indexOf(flag);
  if (index === -1) return undefined;
  const value = rawArgs[index + 1]?.trim();
  return value || undefined;
}

function required(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`missing_${label}`);
  return value.trim();
}

function parseMode(value: string | undefined): "Markdown" | "MarkdownV2" | "HTML" | "none" {
  if (!value || value === "none" || value === "Markdown" || value === "MarkdownV2" || value === "HTML") {
    return value ?? "none";
  }
  throw new Error(`invalid_telegram_parse_mode:${value}`);
}

async function readSendBody(rawArgs: string[]): Promise<string> {
  const text = argValue(rawArgs, "--text");
  const file = argValue(rawArgs, "--file");
  if (text && file) throw new Error("telegram_send_use_text_or_file");
  if (text) return text;
  if (file) return readFile(path.resolve(file), "utf8");
  throw new Error("missing_telegram_message_body");
}

async function readOptionalSendBody(rawArgs: string[]): Promise<string | undefined> {
  if (!argValue(rawArgs, "--text") && !argValue(rawArgs, "--file")) return undefined;
  return readSendBody(rawArgs);
}

async function acquireGatewayLock(lockPath: string): Promise<() => Promise<void>> {
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    const existingPid = Number((await readFile(lockPath, "utf8")).trim());
    if (isProcessAlive(existingPid) && existingPid !== process.pid) {
      throw new Error(`telegram_gateway_already_running:${existingPid}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("telegram_gateway_already_running:")) {
      throw error;
    }
  }
  await writeFile(lockPath, `${process.pid}\n`, "utf8");
  return async () => {
    try {
      const currentPid = Number((await readFile(lockPath, "utf8")).trim());
      if (currentPid === process.pid) await rm(lockPath, { force: true });
    } catch {
      // Stale locks are ignored on next start when the pid is no longer alive.
    }
  };
}

export async function runTelegramGatewayCli(rawArgs = process.argv.slice(2)): Promise<void> {
  const args = new Set(rawArgs);
  if (args.has("--help")) {
    console.log("Usage: npm run cli -- gateway telegram [--once] [--dry-run] [--check-config]");
    console.log("       npm run cli -- gateway telegram send --thread-id <id> --text <message>");
    console.log("       npm run cli -- gateway telegram send --thread-id <id> --document <path> [--text <caption>]");
    return;
  }
  const statePath = defaultStatePath();
  const lockPath = defaultLockPath(statePath);
  let state = await loadGatewayState(statePath);
  const config = await resolveGatewayConfig();
  const dryRun = args.has("--dry-run");
  if (args.has("--check-config")) {
    console.log(
      JSON.stringify({
        ok: config.enabled && Boolean(config.botToken) && config.allowedChatIds.length > 0,
        enabled: config.enabled,
        hasBotToken: Boolean(config.botToken),
        allowedChatIds: config.allowedChatIds.length,
        hasCoordinatorThread: Boolean(config.coordinatorThreadId),
        configPath: defaultConfigPath(),
        statePath,
      }),
    );
    return;
  }
  if (!config.enabled) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "telegram_gateway_disabled",
        configPath: defaultConfigPath(),
      }),
    );
    return;
  }
  if (args.has("--send")) {
    try {
      const threadId = required(argValue(rawArgs, "--thread-id") ?? argValue(rawArgs, "--session-id"), "thread_id");
      const documentPath = argValue(rawArgs, "--document") ?? argValue(rawArgs, "--artifact");
      const body = (await (documentPath ? readOptionalSendBody(rawArgs) : readSendBody(rawArgs)))?.trim();
      if (!documentPath && !body) throw new Error("empty_telegram_message_body");
      const common = {
        token: required(config.botToken, "telegram_bot_token"),
        chatId: required(config.allowedChatIds[0], "telegram_chat_id"),
        threadId,
        sessionId: argValue(rawArgs, "--session-id"),
        state,
        statePath,
        title: argValue(rawArgs, "--title"),
      };
      const result = documentPath
        ? await sendTelegramDocument({
            ...common,
            filePath: documentPath,
            caption: body,
          })
        : await sendTelegramNotification({
            ...common,
            text: body ?? "",
            parseMode: parseMode(argValue(rawArgs, "--parse-mode")),
          });
      if (!result.ok) throw new Error(result.error ?? "telegram_gateway_send_failed");
      console.log(
        JSON.stringify({
          ok: true,
          messageId: result.messageId,
          threadId,
          sent: documentPath ? "document" : "message",
          statePath,
        }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : "telegram_gateway_send_failed",
          statePath,
        }),
      );
      process.exitCode = 1;
    }
    return;
  }
  if (!config.botToken || config.allowedChatIds.length === 0) {
    const needs = [];
    if (!config.botToken) needs.push("telegram.botToken");
    if (config.allowedChatIds.length === 0) needs.push("telegram.allowFrom");
    console.log(
      JSON.stringify({
        ok: false,
        error: "missing_telegram_config",
        needs,
        statePath,
        configPath: defaultConfigPath(),
      }),
    );
    return;
  }

  let releaseLock: (() => Promise<void>) | undefined;
  try {
    releaseLock = await acquireGatewayLock(lockPath);
    do {
      state = mergeGatewayState(state, await loadGatewayState(statePath));
      const pendingResult = await processPendingMessages({
        state,
        config,
        dryRun,
      });
      state = pendingResult.state;
      if (!dryRun) await saveGatewayState(state, statePath);
      const pendingSummary = {
        processed: pendingResult.processed,
        replied: pendingResult.replied,
        queued: pendingResult.queued,
        failed: pendingResult.failed,
      };
      let updates: TelegramUpdate[] = [];
      try {
        updates = await fetchTelegramUpdates({
          token: config.botToken,
          offset: state.updateOffset,
          timeoutSeconds: args.has("--once") ? 0 : 20,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isPollConflict = message.includes("Conflict: terminated by other getUpdates request");
        console.log(
          JSON.stringify({
            ok: false,
            error: isPollConflict ? "telegram_get_updates_conflict" : "telegram_get_updates_failed",
            detail: message,
            retrying: !args.has("--once"),
            pending: pendingSummary,
          }),
        );
        if (args.has("--once")) return;
        await sleep(isPollConflict ? 5000 : 1500);
        continue;
      }
      state = mergeGatewayState(state, await loadGatewayState(statePath));
      const results = [];
      for (const update of updates) {
        const result = await processTelegramUpdate({ update, state, config, dryRun });
        if (!dryRun) state = result.state;
        results.push({
          updateId: update.update_id,
          route: result.route.kind,
          delivered: result.delivered,
          telegramReplied: result.telegramReplied,
          error: result.error,
        });
      }
      if (!dryRun) {
        state = mergeGatewayState(state, await loadGatewayState(statePath));
        await saveGatewayState(state, statePath);
      }
      console.log(
        JSON.stringify({
          ok: true,
          dryRun,
          statePath,
          pending: pendingSummary,
          updates: updates.length,
          results,
          nextOffset: state.updateOffset,
        }),
      );
    } while (!args.has("--once"));
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "telegram_gateway_failed",
        lockPath,
      }),
    );
  } finally {
    await releaseLock?.();
  }
}
