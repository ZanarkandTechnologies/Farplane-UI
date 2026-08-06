"use client";

/** Destination-room framing around an authored semantic landmark prop cluster. */

import { Box, Cylinder, Html } from "@react-three/drei";
import { getOfficeLandmarkTheme, OFFICE_LANDMARK_THEME } from "@/config/office-theme";
import { ACTIVITY_LANDMARK_KINDS, type ActivityLandmarkKind } from "../activity-scenes";
import {
  ACTIVITY_DESTINATION_ROOM_DEPTH,
  ACTIVITY_DESTINATION_ROOM_WIDTH,
} from "../lib/activity-destination-room";
import { ActivityLandmarkAuthoredVisual } from "./activity-landmark-visuals";

const M = OFFICE_LANDMARK_THEME.materials;

function ExecutiveRoomFurniture({ kind }: { kind: ActivityLandmarkKind }) {
  const theme = getOfficeLandmarkTheme(kind);
  const mirror = ACTIVITY_LANDMARK_KINDS.indexOf(kind) % 2 === 0 ? 1 : -1;
  return (
    <group name={`executive-room-furniture-${kind}`}>
      <group position={[-1.72 * mirror, 0, 0.82]} rotation={[0, -0.18 * mirror, 0]}>
        <Box args={[0.86, 0.18, 0.76]} position={[0, 0.38, 0]} castShadow>
          <meshStandardMaterial color={M.upholstery} roughness={0.84} />
        </Box>
        <Box args={[0.86, 0.72, 0.16]} position={[0, 0.76, 0.3]} castShadow>
          <meshStandardMaterial color={M.upholstery} roughness={0.82} />
        </Box>
        <Box args={[0.66, 0.08, 0.58]} position={[0, 0.18, 0]} castShadow>
          <meshStandardMaterial color={M.lightMetal} metalness={0.52} roughness={0.34} />
        </Box>
        <Box args={[0.62, 0.05, 0.48]} position={[0, 0.5, -0.02]}>
          <meshStandardMaterial color={theme.zoneColor} roughness={0.9} />
        </Box>
      </group>
      <group position={[1.72 * mirror, 0, 0.72]}>
        <Cylinder args={[0.38, 0.38, 0.09, 18]} position={[0, 0.55, 0]} castShadow>
          <meshStandardMaterial color={M.warmPaper} roughness={0.42} />
        </Cylinder>
        <Cylinder args={[0.055, 0.07, 0.48, 12]} position={[0, 0.29, 0]}>
          <meshStandardMaterial color={M.lightMetal} metalness={0.58} roughness={0.3} />
        </Cylinder>
        <Cylinder args={[0.25, 0.3, 0.06, 14]} position={[0, 0.035, 0]}>
          <meshStandardMaterial color={M.darkMetal} roughness={0.5} />
        </Cylinder>
      </group>
    </group>
  );
}

export function ActivityLandmarkVisual({
  kind,
  footprintWidth = ACTIVITY_DESTINATION_ROOM_WIDTH,
  footprintDepth = ACTIVITY_DESTINATION_ROOM_DEPTH,
  presentationRotationY = 0,
  destinationBayZone = false,
  destinationBayEdge = "north",
  roomFurnitureStyle,
  roomLabel,
  hostLabel,
}: {
  kind: ActivityLandmarkKind;
  footprintWidth?: number;
  footprintDepth?: number;
  presentationRotationY?: number;
  destinationBayZone?: boolean;
  destinationBayEdge?: "north" | "west" | "east";
  roomFurnitureStyle?: string;
  roomLabel?: string;
  hostLabel?: string;
}) {
  const theme = getOfficeLandmarkTheme(kind);
  const zoneWidth = Math.max(2.4, footprintWidth);
  const zoneDepth = Math.max(2.2, footprintDepth);

  return (
    <group name={`activity-destination-zone-${kind}`}>
      <Box
        args={[zoneWidth - 0.12, 0.045, zoneDepth - 0.12]}
        position={[0, 0.025, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color={destinationBayZone ? "#d5d3c6" : theme.zoneColor}
          emissive="#000000"
          emissiveIntensity={0}
          roughness={0.94}
        />
      </Box>
      {destinationBayZone ? (
        <group
          position={[0, 0, (destinationBayEdge === "north" ? -1 : 1) * (zoneDepth / 2 - 0.17)]}
        >
          <Box
            args={[zoneWidth - 0.08, 1.72, 0.3]}
            position={[0, 0.86, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#8a887d" roughness={0.78} />
          </Box>
          {[-1, 1].map((side) => (
            <Box
              key={side}
              args={[0.18, 1.95, 0.34]}
              position={[side * (zoneWidth / 2 - 0.12), 0.98, 0.03]}
              castShadow
            >
              <meshStandardMaterial color={M.darkWalnut} roughness={0.72} />
            </Box>
          ))}
          <Box args={[zoneWidth - 0.08, 0.16, 0.34]} position={[0, 1.88, 0.03]} castShadow>
            <meshStandardMaterial color={M.darkWalnut} roughness={0.7} />
          </Box>
          <Box args={[zoneWidth - 0.35, 0.055, 0.12]} position={[0, 1.58, 0.17]}>
            <meshStandardMaterial
              color={theme.zoneColor}
              emissive={theme.zoneColor}
              emissiveIntensity={0.22}
            />
          </Box>
        </group>
      ) : null}
      {destinationBayZone ? (
        <Box
          args={[zoneWidth - 0.42, 0.025, zoneDepth - 0.38]}
          position={[0, 0.052, 0.02]}
          receiveShadow
        >
          <meshStandardMaterial color={theme.zoneColor} roughness={0.96} />
        </Box>
      ) : null}
      {destinationBayZone && roomFurnitureStyle === "executive-walnut-v1" ? (
        <ExecutiveRoomFurniture kind={kind} />
      ) : null}
      {roomLabel ? (
        <Html
          center
          position={[0, 2.58, 0]}
          zIndexRange={[104, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="w-[78px] rounded-sm border border-white/20 bg-stone-950/92 px-1.5 py-1 text-center shadow-[0_5px_18px_rgba(0,0,0,0.45)] backdrop-blur-sm">
            <div
              className="mx-auto mb-1 h-0.5 w-6 rounded-full"
              style={{ backgroundColor: theme.zoneColor }}
            />
            <div className="line-clamp-2 min-h-4 text-[7px] font-semibold uppercase leading-[1.15] tracking-[0.06em] text-stone-50">
              {roomLabel}
            </div>
            {hostLabel ? (
              <div className="mt-1 truncate text-[7px] font-medium leading-none text-emerald-200/90">
                {hostLabel} · host
              </div>
            ) : null}
          </div>
        </Html>
      ) : null}
      <group
        name={`activity-destination-presentation-${kind}`}
        position={[0, 0, OFFICE_LANDMARK_THEME.presentation.offsetZ]}
        rotation={[0, presentationRotationY, 0]}
        scale={destinationBayZone ? 0.65 : OFFICE_LANDMARK_THEME.presentation.scale}
      >
        <ActivityLandmarkAuthoredVisual kind={kind} />
      </group>
    </group>
  );
}
