/** Module-owned DEV QA snapshot; OfficeMenu is the sole writer of the public window hook. */

import type { OfficeLineageEdge } from "../scene/thread-lineage-effects";

export type OfficeQaSnapshot = {
  kit?: Record<string, unknown>;
  camera?: Record<string, unknown>;
  storyTiming?: Record<string, number>;
  storyInvocationAt?: number;
  effects?: Array<Record<string, unknown>>;
  seedLineage?: (edge: OfficeLineageEdge) => void;
  runStoryFixture?: (target: [number, number, number] | null) => void;
  applyBuilderFixture?: () => Promise<boolean>;
  quality?: Record<string, unknown>;
};

const snapshot: OfficeQaSnapshot = {};

export function updateOfficeQaState(patch: Partial<OfficeQaSnapshot>): void {
  Object.assign(snapshot, patch);
}

export function getOfficeQaState(): Readonly<OfficeQaSnapshot> {
  return snapshot;
}
