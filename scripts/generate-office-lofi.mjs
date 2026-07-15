#!/usr/bin/env node

/**
 * Generates the curated Farplane Radio office-lofi set through Eleven Music.
 * Inputs: ELEVENLABS_API_KEY and the track briefs below.
 * Outputs: MP3 assets plus a provenance manifest under ui/public/audio/farplane-radio.
 * Side effects: paid ElevenLabs API calls and local asset writes.
 * Invariant: never logs or persists the API key.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
if (!apiKey) {
  throw new Error("ELEVENLABS_API_KEY is required");
}

const outputDir = path.resolve("ui/public/audio/farplane-radio");
const manifestPath = path.join(outputDir, "manifest.json");
const musicLengthMs = 60_000;
const normalization = { integratedLufs: -16, truePeakDb: -1.5, loudnessRange: 11 };
const basePrompt =
  "Instrumental chill lo-fi office music for sustained focused work, 72 to 78 BPM, warm restrained mix, steady low-energy groove, no vocals, no spoken words, no dramatic drops, no abrupt transitions, no recognizable melody, no artist imitation.";

const tracks = [
  {
    id: "late-shift",
    title: "Late Shift",
    direction:
      "Dusty electric piano, muted drums, warm round bass, subtle tape hiss, dim founder control-room atmosphere.",
  },
  {
    id: "quiet-deploy",
    title: "Quiet Deploy",
    direction:
      "Soft jazz guitar harmonics, brushed drums, mellow electric keys, sparse analog synth glow, calm forward motion.",
  },
  {
    id: "server-room-rain",
    title: "Server Room Rain",
    direction:
      "Gentle rain-like texture, filtered Rhodes chords, soft rim clicks, deep unobtrusive bass, cool nocturnal ambience.",
  },
  {
    id: "lantern-desk",
    title: "Lantern Desk",
    direction:
      "Warm felt piano, vinyl dust, understated boom-bap percussion, rounded bass, intimate pool-of-light mood.",
  },
  {
    id: "deep-work-district",
    title: "Deep Work District",
    direction:
      "Minimal electric piano motif, dry soft drums, low analog pulse, spacious background pads, disciplined concentration.",
  },
  {
    id: "midnight-standup",
    title: "Midnight Standup",
    direction:
      "Muted vibraphone, gentle kick and snare, soft sub bass, faint office-night ambience, quietly optimistic tone.",
  },
  {
    id: "soft-compile",
    title: "Soft Compile",
    direction:
      "Rounded synth plucks, tape-worn keys, restrained percussion, smooth bass loop, patient repetitive flow state.",
  },
  {
    id: "empty-office-lights",
    title: "Empty Office Lights",
    direction:
      "Airy electric piano, soft guitar fragments, brushed beat, warm room tone, reflective late-night calm.",
  },
  {
    id: "dawn-merge",
    title: "Dawn Merge",
    direction:
      "Gentle major-seventh keys, subtle shaker and rim percussion, mellow bass, faint sunrise warmth without a climax.",
  },
  {
    id: "farplane-drift",
    title: "Farplane Drift",
    direction:
      "Dreamy analog pads, dusty Rhodes, low-key hip-hop drums, soft bass, spacious futuristic office atmosphere.",
  },
];

async function hasUsableFile(filePath) {
  try {
    return (await stat(filePath)).size > 10_000;
  } catch {
    return false;
  }
}

async function normalizeTrack(sourceBytes, filePath) {
  const sourcePath = `${filePath}.source.mp3`;
  const normalizedPath = `${filePath}.normalized.mp3`;
  await writeFile(sourcePath, sourceBytes);

  try {
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      sourcePath,
      "-af",
      `loudnorm=I=${normalization.integratedLufs}:TP=${normalization.truePeakDb}:LRA=${normalization.loudnessRange}`,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      normalizedPath,
    ]);
    await rename(normalizedPath, filePath);
  } finally {
    await unlink(sourcePath).catch(() => undefined);
    await unlink(normalizedPath).catch(() => undefined);
  }
}

async function fileSha256(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

async function generateTrack(track, existingTrack, existingGeneratedAt) {
  const fileName = `${track.id}.mp3`;
  const filePath = path.join(outputDir, fileName);
  const prompt = `${basePrompt} ${track.direction}`;

  if (await hasUsableFile(filePath)) {
    console.log(`skip ${track.id} (already generated)`);
    return {
      ...track,
      fileName,
      prompt,
      generatedAt: existingTrack?.generatedAt ?? existingGeneratedAt,
      sha256: await fileSha256(filePath),
      skipped: true,
    };
  }

  console.log(`generate ${track.id}`);
  const response = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: musicLengthMs,
      model_id: "music_v2",
      force_instrumental: true,
    }),
  });

  if (!response.ok) {
    const errorBody = (await response.text()).slice(0, 1_000);
    throw new Error(`${track.id}: ElevenLabs ${response.status}: ${errorBody}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 10_000) {
    throw new Error(`${track.id}: generated response was unexpectedly small`);
  }
  await normalizeTrack(bytes, filePath);
  console.log(`done ${track.id} (${bytes.byteLength} source bytes, normalized)`);
  return {
    ...track,
    fileName,
    prompt,
    generatedAt: new Date().toISOString(),
    sha256: await fileSha256(filePath),
    skipped: false,
  };
}

async function runPool(items, concurrency, existingManifest) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const existingTrack = existingManifest?.tracks?.find((track) => track.id === items[index].id);
      results[index] = await generateTrack(
        items[index],
        existingTrack,
        existingManifest?.generatedAt,
      );
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

await mkdir(outputDir, { recursive: true });
await execFileAsync("ffmpeg", ["-version"]);
const existingManifest = await readFile(manifestPath, "utf8")
  .then((contents) => JSON.parse(contents))
  .catch(() => undefined);
const generatedTracks = await runPool(tracks, 2, existingManifest);
const manifestUpdatedAt = new Date().toISOString();
const manifest = {
  schemaVersion: "1.0.0",
  collection: "Farplane Radio: Office Lo-Fi Vol. 1",
  provider: "ElevenLabs",
  model: "music_v2",
  usageTermsUrl: "https://elevenlabs.io/music-api-terms",
  licenseNote:
    "Usage remains subject to the generating ElevenLabs account plan and Music API Terms.",
  forceInstrumental: true,
  musicLengthMs,
  normalization,
  generatedAt: existingManifest?.generatedAt ?? manifestUpdatedAt,
  manifestUpdatedAt,
  tracks: generatedTracks.map(({ skipped: _skipped, ...track }) => track),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`manifest ${manifestPath}`);
