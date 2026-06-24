import { describe, expect, it, vi } from "vitest";
import type { OfficeSettingsModel, UnifiedOfficeModel } from "@/modules/runtime";
import { persistPlacementRepairIfAllowed } from "@/providers/office-data-refresh";

const officeObjects: UnifiedOfficeModel["officeObjects"] = [];

const officeSettings: OfficeSettingsModel = {
  cameraOrientation: "north_east",
  decor: {
    backgroundId: "shell_haze",
    floorPatternId: "sandstone_tiles",
    wallColorId: "gallery_cream",
  },
  meshAssetDir: "",
  officeFootprint: {
    depth: 8,
    width: 8,
  },
  officeLayout: {
    tileSize: 1,
    tiles: [],
    version: 1,
  },
  orbitControlsEnabled: true,
  viewProfile: "free_orbit_3d",
};

describe("persistPlacementRepairIfAllowed", () => {
  it("skips placement repair persistence in read-only mode", async () => {
    const adapter = {
      saveOfficeObjects: vi.fn(),
      saveOfficeSettings: vi.fn(),
    };

    await expect(
      persistPlacementRepairIfAllowed({
        adapter,
        changed: true,
        expandedLayout: true,
        officeObjects,
        officeSettings,
        readOnly: true,
      }),
    ).resolves.toEqual({ skipped: true });

    expect(adapter.saveOfficeObjects).not.toHaveBeenCalled();
    expect(adapter.saveOfficeSettings).not.toHaveBeenCalled();
  });

  it("persists changed placement repairs when writes are allowed", async () => {
    const adapter = {
      saveOfficeObjects: vi.fn().mockResolvedValue({ ok: true, objects: officeObjects }),
      saveOfficeSettings: vi.fn().mockResolvedValue({ ok: true, settings: officeSettings }),
    };

    await expect(
      persistPlacementRepairIfAllowed({
        adapter,
        changed: true,
        expandedLayout: true,
        officeObjects,
        officeSettings,
        readOnly: false,
      }),
    ).resolves.toMatchObject({ skipped: false });

    expect(adapter.saveOfficeObjects).toHaveBeenCalledWith(officeObjects);
    expect(adapter.saveOfficeSettings).toHaveBeenCalledWith(officeSettings);
  });
});
