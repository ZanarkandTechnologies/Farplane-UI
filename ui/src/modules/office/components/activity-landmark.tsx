"use client";

/**
 * ACTIVITY LANDMARK
 * =================
 * Adapts persisted office-object metadata to the interactive activity-room visual.
 * Authored prop clusters and destination-room presentation live in focused sibling components.
 */

import type { OfficeDioramaTheme } from "@/config/office-theme";
import type { Id } from "@/lib/entity-types";
import { getExecutiveSpecialist } from "@/lib/executive-specialists";
import {
  getOfficePresentationRotationY,
  isFixedOfficeSceneView,
  type OfficeSceneViewSettings,
} from "@/modules/office/scene/view-profile";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import {
  ACTIVITY_LANDMARK_KINDS,
  type ActivityLandmarkKind,
  normalizeActivityLandmarkKind,
} from "../activity-scenes";
import {
  ACTIVITY_DESTINATION_ROOM_DEPTH,
  ACTIVITY_DESTINATION_ROOM_WIDTH,
  getActivityDestinationRoomDimensions,
} from "../lib/activity-destination-room";
import { getOperatingRoomDefinition, isOperatingRoomId } from "../lib/operating-room-catalog";
import { parseOfficeObjectInteractionConfig } from "../office-object-ui";
import { ActivityLandmarkVisual } from "./activity-destination-room-visual";
import { InteractiveObject } from "./interactive-object";

export { ActivityLandmarkVisual } from "./activity-destination-room-visual";
export type { ActivityLandmarkKind };
export {
  ACTIVITY_DESTINATION_ROOM_DEPTH,
  ACTIVITY_DESTINATION_ROOM_WIDTH,
  ACTIVITY_LANDMARK_KINDS,
  getActivityDestinationRoomDimensions,
  normalizeActivityLandmarkKind,
};

export function getActivityLandmarkLocalPresentationRotationY(input: {
  objectRotationY: number;
  settings: OfficeSceneViewSettings;
}): number {
  return isFixedOfficeSceneView(input.settings)
    ? getOfficePresentationRotationY(input.settings.cameraOrientation) - input.objectRotationY
    : 0;
}

export default function ActivityLandmark({
  objectId,
  position,
  rotation = [0, 0, 0],
  scale,
  companyId,
  metadata,
  dioramaTheme,
}: {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
  dioramaTheme?: OfficeDioramaTheme;
}) {
  const { officeSettings } = useOfficeDataContext();
  const kind = normalizeActivityLandmarkKind(metadata?.landmarkKind);
  const roomDimensions = getActivityDestinationRoomDimensions(
    typeof metadata?.footprintWidth === "number" ? metadata.footprintWidth : undefined,
    typeof metadata?.footprintDepth === "number" ? metadata.footprintDepth : undefined,
    metadata?.destinationBayZone === true,
  );
  const objectRotationY = rotation?.[1] ?? 0;
  const presentationRotationY = getActivityLandmarkLocalPresentationRotationY({
    objectRotationY,
    settings: officeSettings,
  });
  const interactionConfig = parseOfficeObjectInteractionConfig(metadata);
  const hoverLabel =
    interactionConfig.displayName ??
    interactionConfig.skillBinding?.label ??
    interactionConfig.skillBinding?.skillId ??
    null;
  const operatingRoom = isOperatingRoomId(metadata?.operatingRoomId)
    ? getOperatingRoomDefinition(metadata.operatingRoomId)
    : null;
  const roomHost = operatingRoom ? getExecutiveSpecialist(operatingRoom.hostAgentId) : null;
  const useArchipelagoPresentation = officeSettings.layoutStrategy === "team_neighborhoods";
  return (
    <InteractiveObject
      objectType="activity-landmark"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
      hoverLabel={hoverLabel}
    >
      <ActivityLandmarkVisual
        kind={kind}
        footprintWidth={roomDimensions.width}
        footprintDepth={roomDimensions.depth}
        presentationRotationY={presentationRotationY}
        destinationBayZone={metadata?.destinationBayZone === true}
        destinationBayEdge={
          metadata?.destinationBayEdge === "west" || metadata?.destinationBayEdge === "east"
            ? metadata.destinationBayEdge
            : "north"
        }
        roomFurnitureStyle={
          typeof metadata?.roomFurnitureStyle === "string" ? metadata.roomFurnitureStyle : undefined
        }
        roomLabel={useArchipelagoPresentation ? undefined : operatingRoom?.displayName}
        hostLabel={useArchipelagoPresentation ? undefined : roomHost?.name}
        compactLabel={useArchipelagoPresentation}
        dioramaTheme={dioramaTheme}
      />
    </InteractiveObject>
  );
}
