import { describe, expect, it } from "vitest";

import { stripSecretConfigValues } from "./runtime-config-sanitizer";

describe("runtime config secret sanitizer", () => {
  it("removes legacy secret fields, including invalid-TOML null parses, while preserving settings", () => {
    const config = {
      runtime: { state_base: "http://127.0.0.1:5173" },
      env: {
        FARPLANE_TELEMETRY_TOKEN: "null",
        VITE_GATEWAY_TOKEN: "legacy-secret",
        FARPLANE_STATE_BASE: "http://127.0.0.1:5173",
      },
      integrations: {
        notion_api_key: null,
        slash: { apiKey: "legacy-secret", legal_entity_id: "entity-1" },
      },
      telegram: { bot_token: "legacy-secret", allow_from: ["100"] },
    };

    stripSecretConfigValues(config);

    expect(config).toEqual({
      runtime: { state_base: "http://127.0.0.1:5173" },
      env: { FARPLANE_STATE_BASE: "http://127.0.0.1:5173" },
      integrations: { slash: { legal_entity_id: "entity-1" } },
      telegram: { allow_from: ["100"] },
    });
  });
});
