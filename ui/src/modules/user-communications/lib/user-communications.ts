/**
 * User communications config helpers.
 *
 * Inputs: local browser settings for the Telegram gateway.
 * Outputs: normalized main-thread configuration and shell env snippets.
 * Side effects: none; browser callers own localStorage reads/writes.
 */

export const USER_COMMUNICATIONS_CONFIG_STORAGE_KEY = "farplane:user-communications:telegram";

export type UserCommunicationsConfig = {
  mainThreadId: string;
  stateBase: string;
  botToken: string;
  allowFrom: string;
};

export const DEFAULT_USER_COMMUNICATIONS_CONFIG: UserCommunicationsConfig = {
  mainThreadId: "",
  stateBase: "http://127.0.0.1:5173",
  botToken: "",
  allowFrom: "",
};

export function normalizeUserCommunicationsConfig(
  input: Partial<UserCommunicationsConfig> | null | undefined,
): UserCommunicationsConfig {
  return {
    mainThreadId: input?.mainThreadId?.trim() ?? "",
    stateBase: input?.stateBase?.trim() || DEFAULT_USER_COMMUNICATIONS_CONFIG.stateBase,
    botToken: input?.botToken?.trim() ?? "",
    allowFrom: input?.allowFrom?.trim() ?? "",
  };
}

export function parseUserCommunicationsConfig(raw: string | null): UserCommunicationsConfig {
  if (!raw) return DEFAULT_USER_COMMUNICATIONS_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<UserCommunicationsConfig>;
    return normalizeUserCommunicationsConfig(parsed);
  } catch {
    return DEFAULT_USER_COMMUNICATIONS_CONFIG;
  }
}

export function serializeUserCommunicationsConfig(config: UserCommunicationsConfig): string {
  return JSON.stringify(normalizeUserCommunicationsConfig(config));
}

export function buildTelegramGatewayEnv(_config: UserCommunicationsConfig): string {
  const lines = [
    "npm run cli -- gateway telegram --once",
  ];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

export function buildTelegramGatewayConfigJson(config: UserCommunicationsConfig): string {
  const normalized = normalizeUserCommunicationsConfig(config);
  const allowFrom = normalized.allowFrom
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return `${JSON.stringify(
    {
      version: 1,
      runtime: {
        aiOfficeUrl: normalized.stateBase,
      },
      telegram: {
        enabled: true,
        dmPolicy: "allowlist",
        botToken: normalized.botToken,
        allowFrom,
        mainThreadId: normalized.mainThreadId,
        groupPolicy: "allowlist",
        streaming: { mode: "off" },
      },
    },
    null,
    2,
  )}\n`;
}
