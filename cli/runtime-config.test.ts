import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  firstFarplaneConfigValue,
  readFarplaneConfigValue,
  resolveFarplaneHome,
} from "./runtime-config.js";

async function writeRuntimeConfig(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "config.toml"),
    [
      "[env]",
      'CONVEX_SITE_URL = "https://saved.convex.site"',
      'FARPLANE_STATE_BASE = "http://saved-state.local"',
      'FARPLANE_TELEMETRY_TOKEN = "saved-token"',
      "",
    ].join("\n"),
    "utf8",
  );
}

describe("runtime config resolver", () => {
  it("reads saved settings before env fallbacks", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "farplane-runtime-config-"));
    await writeRuntimeConfig(root);
    const env = {
      FARPLANE_STATE_DIR: root,
      FARPLANE_STATE_BASE: "http://env-state.local",
      FARPLANE_TELEMETRY_TOKEN: "env-token",
    };

    expect(resolveFarplaneHome(env)).toBe(root);
    expect(readFarplaneConfigValue("FARPLANE_STATE_BASE", { env })).toBe(
      "http://saved-state.local",
    );
    expect(readFarplaneConfigValue("FARPLANE_TELEMETRY_TOKEN", { env, secret: true })).toBe(
      "saved-token",
    );
    expect(firstFarplaneConfigValue(["FARPLANE_CONVEX_SITE_URL", "CONVEX_SITE_URL"], { env })).toBe(
      "https://saved.convex.site",
    );
  });

  it("uses explicit test envs without reading local files when no state root is supplied", () => {
    const env = { FARPLANE_STATE_BASE: "http://env-only.local" };

    expect(readFarplaneConfigValue("FARPLANE_STATE_BASE", { env })).toBe("http://env-only.local");
    expect(readFarplaneConfigValue("FARPLANE_TELEMETRY_TOKEN", { env, secret: true })).toBe("");
  });
});
