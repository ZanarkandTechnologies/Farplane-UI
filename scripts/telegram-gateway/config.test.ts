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
        "[runtime]",
        'codex_app_server_url = "ws://127.0.0.1:47892"',
        "",
        "[telegram]",
        "enabled = true",
        'bot_token = "ignored-secret-token"',
        'allow_from = ["100", "200"]',
        'default_thread_id = "thread-ceo"',
        'dm_policy = "allowlist"',
        'group_policy = "allowlist"',
        'review_relay_port = "8790"',
        "",
        "[telegram.streaming]",
        'mode = "off"',
        "",
      ].join("\n"),
      "utf-8",
    );

    await expect(loadGatewayFileConfig(configPath)).resolves.toEqual({
      runtime: {
        appServerUrl: "ws://127.0.0.1:47892",
      },
      telegram: {
        enabled: true,
        allowFrom: ["100", "200"],
        defaultThreadId: "thread-ceo",
        dmPolicy: "allowlist",
        groupPolicy: "allowlist",
        streaming: { mode: "off" },
        reviewRelay: { port: 8790 },
      },
    });
  });
});
