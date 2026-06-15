import { describe, expect, it } from "vitest";

import {
  buildTelegramGatewayEnv,
  buildTelegramGatewayConfigJson,
  DEFAULT_USER_COMMUNICATIONS_CONFIG,
  normalizeUserCommunicationsConfig,
  parseUserCommunicationsConfig,
  serializeUserCommunicationsConfig,
} from "./user-communications";

describe("user communications config helpers", () => {
  it("normalizes the main thread and app-server config", () => {
    expect(
      normalizeUserCommunicationsConfig({
        mainThreadId: " thread-main ",
        stateBase: "",
        botToken: " token ",
        allowFrom: " 100 ",
      }),
    ).toEqual({
      mainThreadId: "thread-main",
      stateBase: DEFAULT_USER_COMMUNICATIONS_CONFIG.stateBase,
      botToken: "token",
      allowFrom: "100",
    });
  });

  it("parses and serializes local browser config", () => {
    const serialized = serializeUserCommunicationsConfig({
      mainThreadId: "thread-main",
      stateBase: " http://localhost:5173 ",
      botToken: "token",
      allowFrom: "100,200",
    });

    expect(parseUserCommunicationsConfig(serialized)).toEqual({
      mainThreadId: "thread-main",
      stateBase: "http://localhost:5173",
      botToken: "token",
      allowFrom: "100,200",
    });
    expect(parseUserCommunicationsConfig("not-json")).toEqual(DEFAULT_USER_COMMUNICATIONS_CONFIG);
  });

  it("builds a gateway command from the configured main thread", () => {
    const config = {
      mainThreadId: "thread-main",
      stateBase: "http://localhost:5173",
      botToken: "token",
      allowFrom: "100, 200",
    };

    expect(buildTelegramGatewayEnv(config)).toBe("npm run cli -- gateway telegram --once");
    expect(JSON.parse(buildTelegramGatewayConfigJson(config))).toEqual(
      expect.objectContaining({
        version: 1,
        runtime: expect.objectContaining({
          aiOfficeUrl: "http://localhost:5173",
        }),
        telegram: expect.objectContaining({
          mainThreadId: "thread-main",
          botToken: "token",
          allowFrom: ["100", "200"],
        }),
      }),
    );
  });
});
