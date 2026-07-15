/**
 * TEAM CLUSTER
 * ============
 *
 * Renders a team's physical workspace with dynamic desk layout.
 *
 * INTERACTION MODES:
 * 1. Placement mode → Click to assign desk to this team
 * 2. Builder mode → Click to open team settings (via context menu)
 * 3. Default mode → Click to open team chat
 *
 * VISUAL BEHAVIOR:
 * - Shows a floating label above team tables
 * - Shows floor circle in builder/placement modes only
 * - Desks auto-arrange using layout utility functions
 */

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { COMPUTER_HEIGHT, DESK_HEIGHT } from "@/constants";
import type { Id } from "@/lib/entity-types";
import type { DeskLayoutData, TeamData } from "@/modules/office/lib/types";
import {
  MAX_GRID_DESKS_PER_TEAM,
  getClusterOccupancyFootprint,
  getDeskPosition,
  getDeskRotation,
  resolveTeamStationLayout,
  solveRoundTeamTableLayout,
} from "@/modules/office/utils/layout";
import { useAppStore } from "@/store";
import Desk from "./desk";
import { InteractiveObject } from "./interactive-object";
import RoundTeamTable from "./round-team-table";
import { shouldShowTeamLabel } from "./team-label";

// Constants
const DEFAULT_OCCUPANCY_WIDTH = 9.2;
const DEFAULT_OCCUPANCY_DEPTH = 7.4;
const FLOATING_LABEL_HEIGHT = DESK_HEIGHT + COMPUTER_HEIGHT + 0.58;

function getPositiveMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

// ============================================================================
// GHOST COMPONENT (For Placement Mode)
// ============================================================================
export function TeamClusterGhost() {
  return (
    <group name="team-marker-ghost">
      {/* Floor Mat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[2, 32]} />
        <meshStandardMaterial color="blue" opacity={0.3} transparent />
      </mesh>
      {/* Center Pole */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
        <meshStandardMaterial color="blue" opacity={0.5} transparent />
      </mesh>
      {/* Banner Flag */}
      <mesh position={[0, 1.5, 0.4]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.05, 0.8, 0.8]} />
        <meshStandardMaterial color="blue" opacity={0.5} transparent />
      </mesh>
    </group>
  );
}

interface TeamClusterProps {
  team: TeamData;
  desks: DeskLayoutData[]; // Desk records from database with real IDs
  handleTeamClick: (team: TeamData) => void;
  onPrimaryAction?: (event: ThreeEvent<MouseEvent>) => void;
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

export default function TeamCluster({
  team,
  desks,
  handleTeamClick,
  onPrimaryAction,
  objectId,
  position,
  rotation,
  companyId,
  metadata,
}: TeamClusterProps) {
  const [isHovered, setIsHovered] = useState(false);

  // App state
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const placementMode = useAppStore((state) => state.placementMode);
  const setPlacementMode = useAppStore((state) => state.setPlacementMode);
  const setIsTeamOptionsDialogOpen = useAppStore((state) => state.setIsTeamOptionsDialogOpen);
  const setActiveTeamForOptions = useAppStore((state) => state.setActiveTeamForOptions);
  const isDragging = useAppStore((state) => state.isDragging);

  // Capacity tracking
  const currentDeskCount = desks.length;
  const stationLayout = resolveTeamStationLayout({
    deskCount: currentDeskCount,
    employeeCount: team.employees.length,
    forceGrid: metadata?.commandCommonsNeighborhood === true,
  });
  const stationCount = stationLayout.stationCount;
  const usesRoundTable = stationLayout.usesRoundTable;

  // Handle cluster click
  const handleClusterClick = (event: ThreeEvent<MouseEvent>) => {
    if (isDragging) return;

    // Priority 1: Placement Mode - Check if placing a desk
    if (placementMode.active && placementMode.type === "desk") {
      event.stopPropagation();

      // Store the pending team ID in placement data so the confirmation panel can use it
      setPlacementMode({
        active: true,
        type: placementMode.type,
        data: {
          ...placementMode.data,
          pendingTeamId: team._id,
          teamName: team.name,
          nextStationCount: currentDeskCount + 1,
        },
      });
      return;
    }

    // Priority 2: Builder Mode → Let InteractiveObject handle selection
    if (isBuilderMode) return;

    // Priority 3: Default Mode → Open the configured primary surface
    event.stopPropagation();
    if (onPrimaryAction) {
      onPrimaryAction(event);
      return;
    }
    handleTeamClick(team);
  };

  // Settings handler (called from context menu)
  const handleOpenSettings = () => {
    setActiveTeamForOptions(team);
    setIsTeamOptionsDialogOpen(true);
  };

  // Enable hover effects when not in builder mode or when in placement mode
  const shouldEnableLocalHover = !isBuilderMode || placementMode.active;

  // Desk layout (auto-calculates positions based on team center)
  const desksWithPositions = useMemo(() => {
    // TeamCluster is already transformed by wrapper position; keep desks local.
    const clusterPos: [number, number, number] = [0, 0, 0];
    const orderedDesks = desks
      .map((desk, originalIndex) => ({
        desk,
        originalIndex,
        // Missing/duplicate indices can happen after sidecar edits.
        // Sort by persisted index, then normalize to compact 0..N-1.
        persistedIndex: Number.isFinite(desk.deskIndex)
          ? (desk.deskIndex as number)
          : Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) =>
        a.persistedIndex === b.persistedIndex
          ? a.originalIndex - b.originalIndex
          : a.persistedIndex - b.persistedIndex,
      );
    const visibleDesks = Array.from(
      { length: stationLayout.visibleGridDeskCount },
      (_, index) =>
        orderedDesks[index] ?? {
          desk: { id: `${objectId}-generated-desk-${index}`, deskIndex: index, team: team.name },
          originalIndex: index,
          persistedIndex: index,
        },
    );
    return visibleDesks
      .map(({ desk }, layoutIndex, visibleDesks) => ({
        id: desk.id,
        position: getDeskPosition(clusterPos, layoutIndex, visibleDesks.length),
        rotationY: getDeskRotation(layoutIndex, visibleDesks.length),
      }));
  }, [desks, objectId, stationLayout.visibleGridDeskCount, team.name]);

  const tableHitTarget = useMemo(() => {
    const footprint = getClusterOccupancyFootprint(
      usesRoundTable ? stationCount : Math.max(desksWithPositions.length, 1),
    );
    const roundTableLayout = usesRoundTable ? solveRoundTeamTableLayout(stationCount) : null;
    const width = roundTableLayout
      ? roundTableLayout.radius * 2 + 0.35
      : (getPositiveMetadataNumber(metadata, "footprintWidth") ?? footprint.width);
    const depth = roundTableLayout
      ? roundTableLayout.radius * 2 + 0.35
      : (getPositiveMetadataNumber(metadata, "footprintDepth") ?? footprint.depth);
    return {
      center: [0, 0.4, 0] as [number, number, number],
      size: [width, 0.8, depth] as [number, number, number],
    };
  }, [desksWithPositions.length, metadata, stationCount, usesRoundTable]);
  const occupancyMat = useMemo(() => {
    const solvedFootprint = getClusterOccupancyFootprint(
      usesRoundTable ? stationCount : Math.max(desks.length, 1),
    );
    return {
      width:
        getPositiveMetadataNumber(metadata, "footprintWidth") ??
        solvedFootprint.width ??
        DEFAULT_OCCUPANCY_WIDTH,
      depth:
        getPositiveMetadataNumber(metadata, "footprintDepth") ??
        solvedFootprint.depth ??
        DEFAULT_OCCUPANCY_DEPTH,
    };
  }, [desks.length, metadata, stationCount, usesRoundTable]);

  // Render conditions
  const showCircle = isBuilderMode || placementMode.active;
  const isCommandNeighborhood = metadata?.commandCommonsNeighborhood === true;
  const showFloatingLabel = shouldShowTeamLabel(team.name);
  const showDeskPlacementDetail =
    placementMode.active && placementMode.type === "desk" && (isHovered || usesRoundTable);
  return (
    <InteractiveObject
      objectType="team-cluster"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      onSettings={handleOpenSettings}
      metadata={metadata}
      supportsScaling={false}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: React Three Fiber group handles scene pointer events, not DOM interaction semantics. */}
      <group
        onPointerEnter={shouldEnableLocalHover ? () => setIsHovered(true) : undefined}
        onPointerLeave={shouldEnableLocalHover ? () => setIsHovered(false) : undefined}
        onClick={handleClusterClick}
      >
        <mesh name={`team-hit-target-${team._id}`} position={tableHitTarget.center}>
          <boxGeometry args={tableHitTarget.size} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Team Marker/Base */}
        <group name="team-marker">
          {/* Floor Mat - Only visible in Builder/Placement mode */}
          {showCircle && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} receiveShadow>
              <planeGeometry args={[occupancyMat.width, occupancyMat.depth]} />
              <meshStandardMaterial
                color={isHovered ? "#a7f3d0" : "#e5e7eb"}
                opacity={0.22}
                transparent
              />
            </mesh>
          )}
        </group>

        <group scale={metadata?.commandCommonsNeighborhood === true ? 1.12 : 1}>
          {usesRoundTable ? (
            <RoundTeamTable
              stationCount={stationCount}
              isHovered={shouldEnableLocalHover && isHovered}
            />
          ) : (
            desksWithPositions.map((desk) => (
              <Desk
                key={desk.id}
                deskId={desk.id}
                position={desk.position}
                rotationY={desk.rotationY}
                isHovered={shouldEnableLocalHover && isHovered}
              />
            ))
          )}
        </group>

        {showFloatingLabel && (
          <Html
            position={[0, FLOATING_LABEL_HEIGHT, 0]}
            center
            zIndexRange={[112, 0]}
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <div className="farplane-team-label-bobble animate-in fade-in zoom-in-95 duration-200">
              <div
                className={`flex items-center justify-center rounded-sm border text-center font-semibold leading-none shadow-md backdrop-blur-sm ${
                  isCommandNeighborhood
                    ? "min-h-[28px] min-w-[96px] max-w-[150px] border-[#a77d58]/55 bg-[#211a16]/92 px-2.5 py-1 text-[10px] text-[#f1dfca] shadow-black/40"
                    : "min-h-[42px] min-w-[176px] max-w-[260px] px-4 py-2 text-[13px]"
                } ${
                  usesRoundTable && placementMode.active && placementMode.type === "desk"
                    ? "border-sky-200/50 bg-sky-400/24 text-cyan-50/95 shadow-sky-400/15"
                    : isCommandNeighborhood
                      ? ""
                      : "border-emerald-100/55 bg-emerald-300/22 text-cyan-50/95 shadow-cyan-200/25"
                }`}
              >
                <div className="line-clamp-2 whitespace-normal break-keep leading-snug [hyphens:none] [overflow-wrap:normal] [word-break:keep-all]">
                  {team.name}
                </div>
                {showDeskPlacementDetail ? (
                  <div className="mt-0.5 text-[8px] opacity-65">
                    {usesRoundTable
                      ? `${stationCount} round-table stations`
                      : `${currentDeskCount}/${MAX_GRID_DESKS_PER_TEAM} desks`}
                  </div>
                ) : null}
              </div>
            </div>
          </Html>
        )}
      </group>
    </InteractiveObject>
  );
}
