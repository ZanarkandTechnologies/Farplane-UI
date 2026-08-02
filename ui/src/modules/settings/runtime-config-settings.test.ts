import { describe, expect, it } from "vitest";

import { credentialSetupCommands } from "./runtime-config-settings";

describe("runtime credential setup guidance", () => {
  it("builds value-free Doppler setup commands for the exact environment name", () => {
    expect(credentialSetupCommands("NOTION_API_KEY")).toEqual({
      setup: "doppler setup",
      set: "doppler secrets set NOTION_API_KEY",
      run: "farplane run -- corepack pnpm run ui",
    });
  });
});
