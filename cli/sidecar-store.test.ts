import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSidecarStore } from "./sidecar-store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createOfficeSettingsFixture(): Promise<{
  directory: string;
  officeSettingsPath: string;
}> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "farplane-sidecar-store-"));
  temporaryDirectories.push(directory);
  vi.stubEnv("FARPLANE_STATE_DIR", directory);
  const officeSettingsPath = path.join(directory, "office.json");
  await writeFile(
    officeSettingsPath,
    `${JSON.stringify(
      {
        layoutStrategy: "area_sorted_pack",
        officeFootprint: { width: 21, depth: 21 },
        officeLayout: { version: 1, tileSize: 1, tiles: ["0:0", "1:0"] },
        decor: {
          floorPatternId: "walnut_parquet",
          wallColorId: "command_charcoal",
          backgroundId: "midnight_tide",
        },
        viewProfile: "fixed_2_5d",
        orbitControlsEnabled: true,
        cameraOrientation: "south_east",
        officeKit: {
          kitId: "command-office",
          kitVersion: 2,
          seed: "executive",
          status: "customized",
          projectCapacity: 7,
          revision: 4,
        },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  return { directory, officeSettingsPath };
}

describe("office settings sidecar codec", () => {
  it("accepts the command-office settings supported by the UI runtime", async () => {
    await createOfficeSettingsFixture();
    const settings = await createSidecarStore().readOfficeSettings();

    expect(settings).toMatchObject({
      layoutStrategy: "area_sorted_pack",
      decor: { wallColorId: "command_charcoal" },
      officeKit: {
        kitId: "command-office",
        kitVersion: 2,
        seed: "executive",
        status: "customized",
        projectCapacity: 7,
        revision: 4,
      },
    });
  });

  it("preserves equipped-kit state through a CLI read/write round trip", async () => {
    const { officeSettingsPath } = await createOfficeSettingsFixture();
    const store = createSidecarStore();

    await store.writeOfficeSettings(await store.readOfficeSettings());

    const persisted = JSON.parse(await readFile(officeSettingsPath, "utf-8")) as Record<
      string,
      unknown
    >;
    expect(persisted).toMatchObject({
      layoutStrategy: "area_sorted_pack",
      decor: { wallColorId: "command_charcoal" },
      officeKit: {
        kitId: "command-office",
        kitVersion: 2,
        seed: "executive",
        status: "customized",
        projectCapacity: 7,
        revision: 4,
      },
    });
  });
});
