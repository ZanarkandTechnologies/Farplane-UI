import { describe, expect, it } from "vitest";
import {
  BUILDER_CAMERA_TRANSITION_MS,
  DEFAULT_CAMERA_TRANSITION_MS,
  getOfficeCameraTransitionDuration,
} from "./use-office-scene-camera";

describe("office camera transition duration", () => {
  it("hands off initial and projection-changing cameras immediately", () => {
    expect(
      getOfficeCameraTransitionDuration({
        nextProjection: "orthographic",
        isBuilderMode: false,
      }),
    ).toBe(0);
    expect(
      getOfficeCameraTransitionDuration({
        previousProjection: "orthographic",
        nextProjection: "perspective",
        previousBuilderMode: false,
        isBuilderMode: true,
      }),
    ).toBe(0);
  });

  it("bounds same-projection Builder transitions", () => {
    expect(
      getOfficeCameraTransitionDuration({
        previousProjection: "perspective",
        nextProjection: "perspective",
        previousBuilderMode: false,
        isBuilderMode: true,
      }),
    ).toBe(BUILDER_CAMERA_TRANSITION_MS);
  });

  it("retains ordinary same-projection camera motion", () => {
    expect(
      getOfficeCameraTransitionDuration({
        previousProjection: "perspective",
        nextProjection: "perspective",
        previousBuilderMode: false,
        isBuilderMode: false,
      }),
    ).toBe(DEFAULT_CAMERA_TRANSITION_MS);
  });
});
