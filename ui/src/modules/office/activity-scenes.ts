"use client";

/**
 * ACTIVITY SCENES
 * ===============
 * Owns the pure presentation catalog shared by activity landmarks, idle-interest
 * targets, scene projection, locomotion engagement, and character renderers.
 * Scenes are derived UI state: they never claim work happened or persist runtime state.
 */

import { OFFICE_LANDMARK_KINDS, type OfficeLandmarkKind } from "@/config/office-theme";

export const ACTIVITY_LANDMARK_KINDS = OFFICE_LANDMARK_KINDS;
export type ActivityLandmarkKind = OfficeLandmarkKind;

export type ActivitySceneKey =
  | "train-skill"
  | "read-book"
  | "produce-media"
  | "plan-at-board"
  | "operate-arcade"
  | "build-at-bench"
  | "catalog-resources"
  | "send-message"
  | "inspect-metrics"
  | "trace-thread"
  | "examine-hologram";

export type ActivityScenePropKind =
  | "training-orb"
  | "book"
  | "camera"
  | "planning-cards"
  | "arcade-controls"
  | "tool"
  | "archive-box"
  | "handset"
  | "chart"
  | "data-nodes"
  | "hologram";

export type ActivityScenePresentation = {
  sceneKey: ActivitySceneKey;
  label: string;
  propKind: ActivityScenePropKind;
  baseSpriteAnimation: "review" | "running" | "waiting";
  ambientPhrases: string[];
  accentColor: string;
};

const ACTIVITY_SCENES: Record<ActivityLandmarkKind, ActivityScenePresentation> = {
  gym: {
    sceneKey: "train-skill",
    label: "Training",
    propKind: "training-orb",
    baseSpriteAnimation: "running",
    ambientPhrases: ["Trying a short practice drill", "Stretching between tasks"],
    accentColor: "#0ea5e9",
  },
  library: {
    sceneKey: "read-book",
    label: "Reading",
    propKind: "book",
    baseSpriteAnimation: "review",
    ambientPhrases: ["Browsing a reference book", "Reading between tasks"],
    accentColor: "#fbbf24",
  },
  studio: {
    sceneKey: "produce-media",
    label: "Producing",
    propKind: "camera",
    baseSpriteAnimation: "review",
    ambientPhrases: ["Looking through the studio setup", "Sketching a visual idea"],
    accentColor: "#a78bfa",
  },
  planning: {
    sceneKey: "plan-at-board",
    label: "Planning",
    propKind: "planning-cards",
    baseSpriteAnimation: "review",
    ambientPhrases: ["Reviewing the planning board", "Reordering a few idea cards"],
    accentColor: "#38bdf8",
  },
  "qa-arcade": {
    sceneKey: "operate-arcade",
    label: "Testing",
    propKind: "arcade-controls",
    baseSpriteAnimation: "running",
    ambientPhrases: ["Trying the QA cabinet", "Checking the demo controls"],
    accentColor: "#22d3ee",
  },
  workshop: {
    sceneKey: "build-at-bench",
    label: "Building",
    propKind: "tool",
    baseSpriteAnimation: "running",
    ambientPhrases: ["Inspecting the workshop tools", "Tidying the test bench"],
    accentColor: "#f59e0b",
  },
  "skill-lab": {
    sceneKey: "train-skill",
    label: "Training",
    propKind: "training-orb",
    baseSpriteAnimation: "running",
    ambientPhrases: ["Trying a practice drill", "Calibrating the skill station"],
    accentColor: "#34d399",
  },
  "organization-hall": {
    sceneKey: "plan-at-board",
    label: "Organizing",
    propKind: "planning-cards",
    baseSpriteAnimation: "review",
    ambientPhrases: ["Reviewing the organization board", "Looking over the team map"],
    accentColor: "#f59e0b",
  },
  "resource-archive": {
    sceneKey: "catalog-resources",
    label: "Cataloging",
    propKind: "archive-box",
    baseSpriteAnimation: "review",
    ambientPhrases: ["Browsing the resource archive", "Checking an archive label"],
    accentColor: "#ca8a04",
  },
  "comms-hub": {
    sceneKey: "send-message",
    label: "Communicating",
    propKind: "handset",
    baseSpriteAnimation: "review",
    ambientPhrases: ["Checking the comms equipment", "Listening for office updates"],
    accentColor: "#38bdf8",
  },
  "telemetry-console": {
    sceneKey: "inspect-metrics",
    label: "Inspecting metrics",
    propKind: "chart",
    baseSpriteAnimation: "review",
    ambientPhrases: ["Glancing over the office metrics", "Checking a dashboard trace"],
    accentColor: "#4ade80",
  },
  "thread-data-lab": {
    sceneKey: "trace-thread",
    label: "Tracing data",
    propKind: "data-nodes",
    baseSpriteAnimation: "review",
    ambientPhrases: ["Exploring a sample thread graph", "Following a data connection"],
    accentColor: "#c084fc",
  },
  "world-orb": {
    sceneKey: "examine-hologram",
    label: "Examining the world",
    propKind: "hologram",
    baseSpriteAnimation: "review",
    ambientPhrases: ["Looking over the world map", "Exploring a map connection"],
    accentColor: "#22d3ee",
  },
};

export function normalizeActivityLandmarkKind(value: unknown): ActivityLandmarkKind {
  return typeof value === "string" &&
    ACTIVITY_LANDMARK_KINDS.includes(value as ActivityLandmarkKind)
    ? (value as ActivityLandmarkKind)
    : "gym";
}

export function getActivityScenePresentation(
  kind: ActivityLandmarkKind,
): ActivityScenePresentation {
  return ACTIVITY_SCENES[kind];
}

export function resolveActivityScenePresentation(
  metadata: Record<string, unknown> | undefined,
): ActivityScenePresentation {
  return getActivityScenePresentation(normalizeActivityLandmarkKind(metadata?.landmarkKind));
}
