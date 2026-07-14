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

const DEFAULT_RESPONSE_TIMEOUT_MS = 180000;
const DEFAULT_REVIEW_RELAY_PORT = 8789;

const execFileAsync = promisify(execFile);

export function defaultConfigPath(): string {
  const root = process.env.FARPLANE_STATE_DIR?.trim() || path.join(os.homedir(), ".farplane");
  return path.join(root, "config.toml");
}

export async function loadGatewayFileConfig(
  configPath = defaultConfigPath(),
): Promise<TelegramGatewayFileConfig> {
  const telegram = readFarplaneConfigFileObject(configPath, ["telegram"]);
  const runtime = readFarplaneConfigFileObject(configPath, ["runtime"]);
  return {
    ...(runtime && typeof runtime === "object" && !Array.isArray(runtime)
      ? { runtime: normalizeRuntimeConfig(runtime as Record<string, unknown>) }
      : {}),
    ...(telegram && typeof telegram === "object" && !Array.isArray(telegram)
      ? { telegram: normalizeTelegramConfig(telegram as Record<string, unknown>) }
      : {}),
  };
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
    readFarplaneConfigValue("TELEGRAM_RESPONSE_TIMEOUT_MS") || String(DEFAULT_RESPONSE_TIMEOUT_MS),
  );
  return {
    enabled: fileConfig.telegram?.enabled !== false,
    botToken: envToken ?? fileConfig.telegram?.botToken?.trim() ?? "",
    responseTimeoutMs:
      Number.isFinite(responseTimeoutMs) && responseTimeoutMs >= 0 ? responseTimeoutMs : DEFAULT_RESPONSE_TIMEOUT_MS,
    appServerUrl:
      process.env.CODEX_APP_SERVER_URL?.trim() ||
      process.env.VITE_CODEX_APP_SERVER_URL?.trim() ||
      process.env.FARPLANE_CODEX_APP_SERVER_URL?.trim() ||
      fileConfig.runtime?.appServerUrl?.trim() ||
      "ws://127.0.0.1:47892",
    allowedChatIds,
    defaultThreadId:
      process.env.TELEGRAM_DEFAULT_THREAD_ID?.trim() ||
      fileConfig.telegram?.defaultThreadId?.trim() ||
      undefined,
    reviewRelayPort: parsePositiveInt(
      process.env.FARPLANE_REVIEW_RELAY_PORT ||
        String(fileConfig.telegram?.reviewRelay?.port ?? DEFAULT_REVIEW_RELAY_PORT),
      DEFAULT_REVIEW_RELAY_PORT,
    ),
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
    defaultThreadId: stringValue(row.default_thread_id) || stringValue(row.defaultThreadId),
    streaming: {
      mode: streaming.mode === "off" ? "off" : undefined,
    },
    reviewRelay: {
      port: parsePositiveInt(
        stringValue(row.review_relay_port) || stringValue(row.reviewRelayPort),
        DEFAULT_REVIEW_RELAY_PORT,
      ),
    },
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRuntimeConfig(
  row: Record<string, unknown>,
): NonNullable<TelegramGatewayFileConfig["runtime"]> {
  return {
    appServerUrl:
      stringValue(row.codex_app_server_url) ||
      stringValue(row.codexAppServerUrl) ||
      stringValue(row.app_server_url) ||
      stringValue(row.appServerUrl),
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
