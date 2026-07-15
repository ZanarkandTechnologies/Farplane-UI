import { describe, expect, it } from "vitest";

import {
  nextTrackIndex,
  previousTrackIndex,
  toggleMuteState,
  wrapTrackIndex,
} from "./player-state";
import { FARPLANE_RADIO_TRACKS } from "./playlist";

describe("soundtrack player state", () => {
  it("ships the ten-track Farplane Radio collection", () => {
    expect(FARPLANE_RADIO_TRACKS).toHaveLength(10);
    expect(new Set(FARPLANE_RADIO_TRACKS.map((track) => track.id)).size).toBe(10);
  });

  it("wraps the final track back to the first", () => {
    expect(nextTrackIndex(9, 10)).toBe(0);
  });

  it("wraps previous from the first track to the final track", () => {
    expect(previousTrackIndex(0, 10)).toBe(9);
  });

  it("normalizes arbitrary indices and empty playlists safely", () => {
    expect(wrapTrackIndex(22, 10)).toBe(2);
    expect(wrapTrackIndex(-12, 10)).toBe(8);
    expect(wrapTrackIndex(4, 0)).toBe(0);
  });

  it("restores the last audible volume when unmuting from zero", () => {
    expect(toggleMuteState({ isMuted: true, lastAudibleVolume: 0.28, volume: 0 }, 0.28)).toEqual({
      isMuted: false,
      lastAudibleVolume: 0.28,
      volume: 0.28,
    });
  });
});
