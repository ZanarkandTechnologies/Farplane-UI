/**
 * Curated Farplane Radio playlist presented by the soundtrack module.
 * Inputs are generated assets under ui/public; output is stable UI metadata.
 * Keep ids aligned with the generation script and provenance manifest.
 */

export type SoundtrackTrack = {
  id: string;
  title: string;
  src: string;
};

const FARPLANE_RADIO_BASE = "/audio/farplane-radio";

export const FARPLANE_RADIO_TRACKS = [
  { id: "late-shift", title: "Late Shift" },
  { id: "quiet-deploy", title: "Quiet Deploy" },
  { id: "server-room-rain", title: "Server Room Rain" },
  { id: "lantern-desk", title: "Lantern Desk" },
  { id: "deep-work-district", title: "Deep Work District" },
  { id: "midnight-standup", title: "Midnight Standup" },
  { id: "soft-compile", title: "Soft Compile" },
  { id: "empty-office-lights", title: "Empty Office Lights" },
  { id: "dawn-merge", title: "Dawn Merge" },
  { id: "farplane-drift", title: "Farplane Drift" },
].map(
  (track): SoundtrackTrack => ({
    ...track,
    src: `${FARPLANE_RADIO_BASE}/${track.id}.mp3`,
  }),
);
