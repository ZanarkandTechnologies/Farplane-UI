import { describe, expect, it } from "vitest";

import {
  buildTelegramGatewayConfigToml,
  buildTelegramGatewayEnv,
  buildUserCommunicationActivityRows,
  DEFAULT_USER_COMMUNICATIONS_CONFIG,
  filterUserCommunicationActivityRows,
  normalizeTelegramGatewayState,
  normalizeUserCommunicationsConfig,
} from "./user-communications";

describe("user communications config helpers", () => {
  it("normalizes the main thread and app-server config", () => {
    expect(
      normalizeUserCommunicationsConfig({
        mainThreadId: " thread-main ",
        stateBase: "",
        codexAppServerUrl: "",
        botToken: " token ",
        allowFrom: " 100 ",
      }),
    ).toEqual({
      mainThreadId: "thread-main",
      stateBase: DEFAULT_USER_COMMUNICATIONS_CONFIG.stateBase,
      codexAppServerUrl: DEFAULT_USER_COMMUNICATIONS_CONFIG.codexAppServerUrl,
      botToken: "token",
      botTokenConfigured: true,
      allowFrom: "100",
    });
  });

  it("builds a gateway command from the configured main thread", () => {
    const config = {
      mainThreadId: "thread-main",
      stateBase: "http://localhost:5173",
      codexAppServerUrl: "ws://127.0.0.1:47891",
      botToken: "token",
      botTokenConfigured: true,
      allowFrom: "100, 200",
    };

    expect(buildTelegramGatewayEnv(config)).toBe("npm run cli -- gateway telegram --once");
    expect(buildTelegramGatewayConfigToml(config)).toContain("[telegram]");
    expect(buildTelegramGatewayConfigToml(config)).toContain('main_thread_id = "thread-main"');
    expect(buildTelegramGatewayConfigToml(config)).toContain('allow_from = ["100", "200"]');
  });

  it("builds activity rows from gateway state", () => {
    const state = normalizeTelegramGatewayState({
      updateOffset: 12,
      mappings: [
        {
          telegramMessageId: 10,
          chatId: "100",
          threadId: "thread-a",
          title: "Gateway work",
          createdAt: 1000,
        },
        {
          telegramMessageId: 11,
          chatId: "100",
          threadId: "thread-b",
          title: "UI polish",
          createdAt: 2000,
        },
      ],
      history: [
        {
          telegramMessageId: 20,
          chatId: "100",
          direction: "inbound",
          text: "Approved",
          occurredAt: 3000,
          route: "source_thread",
          threadId: "thread-a",
        },
        {
          telegramMessageId: 21,
          chatId: "100",
          direction: "inbound",
          text: "What needs me?",
          occurredAt: 2500,
          route: "coordinator",
          threadId: "thread-main",
        },
        {
          telegramMessageId: 22,
          chatId: "100",
          direction: "inbound",
          text: "Where did this go?",
          occurredAt: 2400,
          route: "unknown_reply",
        },
      ],
    });

    const rows = buildUserCommunicationActivityRows(state);

    expect(rows.map((row) => [row.route, row.status])).toEqual([
      ["reply -> source", "delivered"],
      ["standalone -> main", "delivered"],
      ["unknown reply", "failed"],
      ["notification sent", "waiting reply"],
      ["notification sent", "waiting reply"],
    ]);
    expect(filterUserCommunicationActivityRows(rows, "failed", "")).toHaveLength(1);
    expect(filterUserCommunicationActivityRows(rows, "reply", "gateway")).toHaveLength(1);
  });
});
