import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadGatewayFileConfig } from "./config";

describe("telegram gateway config", () => {
  it("loads Telegram settings from Farplane config.toml", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "farplane-telegram-config-"));
    const configPath = path.join(root, "config.toml");
    await writeFile(
      configPath,
      [
        "[telegram]",
        "enabled = true",
        'bot_token = "secret-token"',
        'allow_from = ["100", "200"]',
        'main_thread_id = "thread-main"',
        'dm_policy = "allowlist"',
        'group_policy = "allowlist"',
        "",
        "[telegram.streaming]",
        'mode = "off"',
        "",
      ].join("\n"),
      "utf-8",
    );

    await expect(loadGatewayFileConfig(configPath)).resolves.toEqual({
      telegram: {
        enabled: true,
        botToken: "secret-token",
        allowFrom: ["100", "200"],
        mainThreadId: "thread-main",
        dmPolicy: "allowlist",
        groupPolicy: "allowlist",
        streaming: { mode: "off" },
      },
    });
  });
});
