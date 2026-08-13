import { describe, expect, it } from "vitest";
import {
  EXTERNAL_CONFIGURATION_ITEMS,
  LOCAL_CONFIGURATION_ITEMS,
  OPERATOR_CONFIGURATION_ITEMS,
  PROJECT_CONFIGURATION_ITEMS,
  projectConfigurationItems,
} from "./configuration-catalog";

describe("configuration catalog", () => {
  it("keeps every non-project contract explicit about its owner and access", () => {
    const items = [
      ...OPERATOR_CONFIGURATION_ITEMS,
      ...LOCAL_CONFIGURATION_ITEMS,
      ...PROJECT_CONFIGURATION_ITEMS,
      ...EXTERNAL_CONFIGURATION_ITEMS,
    ];

    expect(items).toHaveLength(26);
    expect(items.every((item) => item.owner && item.access && item.location)).toBe(true);
    expect(items.find((item) => item.id === "doppler-secrets")?.access).toBe(
      "Secret readiness only",
    );
    expect(items.find((item) => item.id === "operator-slash-finance")?.access).toBe(
      "File or CLI only",
    );
  });

  it("uses only project-relative locations for the served project inventory", () => {
    const items = projectConfigurationItems([
      {
        id: "farplane/manifest.json",
        path: "farplane/manifest.json",
        title: "Manifest",
        format: "json",
        exists: true,
      },
      {
        id: "farplane/brand.yaml",
        path: "farplane/brand.yaml",
        title: "Brand",
        format: "yaml",
        exists: true,
      },
    ]);

    expect(items.map((item) => item.location)).toEqual([
      "farplane/manifest.json",
      "farplane/brand.yaml",
    ]);
    expect(items.find((item) => item.id === "project-farplane/brand.yaml")?.owner).toBe(
      "Resource Bank → Brand Kits",
    );
  });
});
