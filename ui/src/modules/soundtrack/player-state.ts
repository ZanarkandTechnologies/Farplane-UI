/** Pure playlist navigation used by the soundtrack player and its tests. */

export function wrapTrackIndex(index: number, trackCount: number): number {
  if (!Number.isInteger(trackCount) || trackCount <= 0) return 0;
  return ((index % trackCount) + trackCount) % trackCount;
}

export function nextTrackIndex(currentIndex: number, trackCount: number): number {
  return wrapTrackIndex(currentIndex + 1, trackCount);
}

export function previousTrackIndex(currentIndex: number, trackCount: number): number {
  return wrapTrackIndex(currentIndex - 1, trackCount);
}

export type MuteState = {
  isMuted: boolean;
  lastAudibleVolume: number;
  volume: number;
};

export function toggleMuteState(state: MuteState, defaultVolume: number): MuteState {
  if (state.isMuted || state.volume === 0) {
    const restoredVolume = state.lastAudibleVolume > 0 ? state.lastAudibleVolume : defaultVolume;
    return { isMuted: false, lastAudibleVolume: restoredVolume, volume: restoredVolume };
  }

  return { ...state, isMuted: true, lastAudibleVolume: state.volume };
}
