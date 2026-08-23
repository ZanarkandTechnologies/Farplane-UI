/** Module-owned DEV QA snapshot; OfficeMenu is the sole writer of the public window hook. */

import type { SkillInvocationEvent } from "../../skill-invocations/skill-invocations-types";
import type { RoomActivityGroup } from "../lib/room-activity-projection";
import type { OfficeLineageEdge } from "../scene/thread-lineage-effects";

export type OfficeQaSnapshot = {
  kit?: Record<string, unknown>;
  camera?: Record<string, unknown>;
  storyTiming?: Record<string, number>;
  storyInvocationAt?: number;
  effects?: Array<Record<string, unknown>>;
  seedLineage?: (edge: OfficeLineageEdge) => void;
  seedRoomActivity?: (groups: RoomActivityGroup[] | null) => void;
  seedObservedSkillFlow?: (events: SkillInvocationEvent[] | null) => void;
  runStoryFixture?: (target: [number, number, number] | null) => void;
  applyBuilderFixture?: () => Promise<boolean>;
  quality?: Record<string, unknown>;
  archipelago?: {
    enabled: boolean;
    islandCount: number;
    bridgeCount: number;
    roomCount: number;
  };
  projectCouncil?: {
    enabled: boolean;
    sectorCount: number;
    visibleProjectIds: string[];
    specialistStationCount: number;
  };
  roomActivity?: {
    roomCount: number;
    visibleCount: number;
    overflowCount: number;
    rooms: Array<{
      roomId: string;
      projects: string[];
      visibleCount: number;
      overflowCount: number;
    }>;
  };
  observedSkillFlow?: {
    visibleCount: number;
    headLinkCount: number;
    furnitureLinkCount: number;
    sessions: string[];
  };
};

const snapshot: OfficeQaSnapshot = {};

export function updateOfficeQaState(patch: Partial<OfficeQaSnapshot>): void {
  Object.assign(snapshot, patch);
}

export function getOfficeQaState(): Readonly<OfficeQaSnapshot> {
  return snapshot;
}
