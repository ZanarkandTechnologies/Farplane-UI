import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LANDMARK_KINDS,
  getActivityScenePresentation,
  normalizeActivityLandmarkKind,
  resolveActivityScenePresentation,
} from "./activity-scenes";

describe("activity scene catalog", () => {
  it("gives every persisted landmark kind an honest activity presentation", () => {
    for (const kind of ACTIVITY_LANDMARK_KINDS) {
      const scene = getActivityScenePresentation(kind);
      expect(scene.sceneKey).toBeTruthy();
      expect(scene.label).toBeTruthy();
      expect(scene.ambientPhrases.length).toBeGreaterThan(0);
      expect(
        scene.ambientPhrases.every((phrase) => !/running|completed|sent|tested/i.test(phrase)),
      ).toBe(true);
    }
  });

  it("resolves the Library to the existing review animation and shared book", () => {
    expect(resolveActivityScenePresentation({ landmarkKind: "library" })).toMatchObject({
      sceneKey: "read-book",
      propKind: "book",
      baseSpriteAnimation: "review",
    });
  });

  it("keeps the legacy fallback stable", () => {
    expect(normalizeActivityLandmarkKind("unknown")).toBe("gym");
  });

  it("gives Finance Office a distinct ledger treatment", () => {
    expect(getActivityScenePresentation("finance-office")).toMatchObject({
      label: "Reviewing finances",
      propKind: "chart",
      accentColor: "#37c987",
    });
  });
});
