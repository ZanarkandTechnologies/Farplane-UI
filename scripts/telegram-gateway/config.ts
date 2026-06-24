/**
 * Config loading for the Telegram gateway.
 *
 * Inputs: env vars, keychain token fallback, and ~/.farplane/config.json.
 * Outputs: resolved gateway config for CLI/runtime use.
 * Side effects: reads local config and may read macOS keychain.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { readFarplaneConfigValue } from "../../cli/runtime-config.js";
import type { ResolvedTelegramGatewayConfig, TelegramGatewayFileConfig } from "./types";

const execFileAsync = promisify(execFile);

export function defaultConfigPath(): string {
  const root = process.env.FARPLANE_STATE_DIR?.trim() || path.join(os.homedir(), ".farplane");
  return path.join(root, "config.json");
}

export async function loadGatewayFileConfig(configPath = defaultConfigPath()): Promise<TelegramGatewayFileConfig> {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as TelegramGatewayFileConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function resolveGatewayConfig(): Promise<ResolvedTelegramGatewayConfig> {
  const fileConfig = await loadGatewayFileConfig();
  const envAllowFrom = parseList(process.env.TELEGRAM_ALLOW_FROM);
  const legacyChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const allowedChatIds =
    envAllowFrom.length > 0
      ? envAllowFrom
      : legacyChatId
        ? [legacyChatId]
        : (fileConfig.telegram?.allowFrom ?? []).map(String).map((entry) => entry.trim()).filter(Boolean);
  const envToken = await readTelegramToken();
  const responseTimeoutMs = Number(readFarplaneConfigValue("TELEGRAM_RESPONSE_TIMEOUT_MS") || "120000");
  const codexAppServerUrl = (
    fileConfig.runtime?.codexAppServerUrl?.trim() ||
    readFarplaneConfigValue("CODEX_APP_SERVER_URL") ||
    readFarplaneConfigValue("FARPLANE_CODEX_APP_SERVER_URL") ||
    readFarplaneConfigValue("VITE_CODEX_APP_SERVER_URL") ||
    ""
  );
  return {
    enabled: fileConfig.telegram?.enabled !== false,
    botToken: envToken ?? fileConfig.telegram?.botToken?.trim() ?? "",
    responseTimeoutMs: Number.isFinite(responseTimeoutMs) && responseTimeoutMs >= 0 ? responseTimeoutMs : 120000,
    allowedChatIds,
    codexAppServerUrl,
    coordinatorThreadId:
      process.env.TELEGRAM_COORDINATOR_THREAD_ID?.trim() ||
      fileConfig.telegram?.mainThreadId?.trim() ||
      fileConfig.mainThreadId?.trim() ||
      undefined,
    stateBase:
      fileConfig.runtime?.aiOfficeUrl?.trim() ||
      fileConfig.runtime?.stateBase?.trim() ||
      fileConfig.stateBase?.trim() ||
      readFarplaneConfigValue("FARPLANE_STATE_BASE") ||
      readFarplaneConfigValue("VITE_STATE_URL") ||
      "http://127.0.0.1:5173",
  };
}

async function readTelegramToken(): Promise<string | null> {
  const envToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (envToken) return envToken;
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-a",
      process.env.USER ?? "",
      "-s",
      "codex-telegram-bot-token",
      "-w",
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
