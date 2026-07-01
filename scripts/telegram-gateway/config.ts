/**
 * Config loading for the Telegram gateway.
 *
 * Inputs: env vars, keychain token fallback, and ~/.farplane/config.toml.
 * Outputs: resolved gateway config for CLI/runtime use.
 * Side effects: reads local config and may read macOS keychain.
 */

import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { readFarplaneConfigFileObject, readFarplaneConfigValue } from "../../cli/runtime-config.js";
import type { ResolvedTelegramGatewayConfig, TelegramGatewayFileConfig } from "./types";

const execFileAsync = promisify(execFile);

export function defaultConfigPath(): string {
  const root = process.env.FARPLANE_STATE_DIR?.trim() || path.join(os.homedir(), ".farplane");
  return path.join(root, "config.toml");
}

export async function loadGatewayFileConfig(
  configPath = defaultConfigPath(),
): Promise<TelegramGatewayFileConfig> {
  const telegram = readFarplaneConfigFileObject(configPath, ["telegram"]);
  return telegram && typeof telegram === "object" && !Array.isArray(telegram)
    ? { telegram: normalizeTelegramConfig(telegram as Record<string, unknown>) }
    : {};
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
        : (fileConfig.telegram?.allowFrom ?? [])
            .map(String)
            .map((entry) => entry.trim())
            .filter(Boolean);
  const envToken = await readTelegramToken();
  const responseTimeoutMs = Number(
    readFarplaneConfigValue("TELEGRAM_RESPONSE_TIMEOUT_MS") || "300000",
  );
  return {
    enabled: fileConfig.telegram?.enabled !== false,
    botToken: envToken ?? fileConfig.telegram?.botToken?.trim() ?? "",
    responseTimeoutMs:
      Number.isFinite(responseTimeoutMs) && responseTimeoutMs >= 0 ? responseTimeoutMs : 300000,
    allowedChatIds,
    coordinatorThreadId:
      process.env.TELEGRAM_COORDINATOR_THREAD_ID?.trim() ||
      fileConfig.telegram?.mainThreadId?.trim() ||
      fileConfig.mainThreadId?.trim() ||
      undefined,
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(String)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeTelegramConfig(
  row: Record<string, unknown>,
): NonNullable<TelegramGatewayFileConfig["telegram"]> {
  const streaming =
    row.streaming && typeof row.streaming === "object" && !Array.isArray(row.streaming)
      ? (row.streaming as Record<string, unknown>)
      : {};
  return {
    enabled: typeof row.enabled === "boolean" ? row.enabled : undefined,
    dmPolicy:
      row.dm_policy === "allowlist" || row.dmPolicy === "allowlist" ? "allowlist" : undefined,
    groupPolicy:
      row.group_policy === "allowlist" || row.groupPolicy === "allowlist" ? "allowlist" : undefined,
    botToken: stringValue(row.bot_token) || stringValue(row.botToken),
    allowFrom:
      stringList(row.allow_from).length > 0
        ? stringList(row.allow_from)
        : stringList(row.allowFrom),
    mainThreadId: stringValue(row.main_thread_id) || stringValue(row.mainThreadId),
    streaming: {
      mode: streaming.mode === "off" ? "off" : undefined,
    },
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
