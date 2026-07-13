/**
 * OFFICE ROOM SHELL
 * =================
 * Tile-based floor and auto-wall geometry for the office container.
 *
 * KEY CONCEPTS:
 * - Room chrome is presentation-only and derives from the persisted office layout mask.
 * - Builder mode should favor readability over decoration, so the floor pattern is intentionally muted while editing.
 *
 * USAGE:
 * - Render inside `SceneContents` and pass the floor ref plus background click handler.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0165
 */

import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import type * as THREE from "three";
import type { getOfficeTheme } from "@/config/office-theme";
import { WALL_HEIGHT } from "@/constants";
import { getWallColorPreset } from "@/modules/office/lib/office-decor";
import type { OfficeFootprint } from "@/modules/office/lib/office-footprint";
import {
  getOfficeLayoutBounds,
  getOfficeLayoutWallSegments,
  type OfficeLayoutModel,
} from "@/modules/office/lib/office-layout";
import type { OfficeSettingsModel } from "@/modules/runtime";
import { OfficeInstancedFloor } from "./office-instanced-floor";
import type { OfficeSceneViewSettings } from "./view-profile";

export interface WallFadeMask {
  frontNorth: boolean;
  frontSouth: boolean;
  frontWest: boolean;
  frontEast: boolean;
  fadeStrength: number;
}

const ORBIT_WALL_FADE_START_DISTANCE = 7;
const ORBIT_WALL_FADE_END_DISTANCE = 1.35;
const ORBIT_WALL_MIN_OPACITY = 0.1;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** In fixed 2.5D, the two "front" walls (facing camera) get zoom-based opacity; others stay full. */
function getFrontWallsForOpacity(settings: OfficeSceneViewSettings): WallFadeMask {
  if (settings.viewProfile !== "fixed_2_5d") {
    return {
      frontNorth: false,
      frontSouth: false,
      frontWest: false,
      frontEast: false,
      fadeStrength: 0,
    };
  }
  switch (settings.cameraOrientation) {
    case "south_west":
      return {
        frontNorth: false,
        frontSouth: true,
        frontWest: true,
        frontEast: false,
        fadeStrength: 1,
      };
    case "north_east":
      return {
        frontNorth: true,
        frontSouth: false,
        frontWest: false,
        frontEast: true,
        fadeStrength: 1,
      };
    case "north_west":
      return {
        frontNorth: true,
        frontSouth: false,
        frontWest: true,
        frontEast: false,
        fadeStrength: 1,
      };
    default:
      return {
        frontNorth: false,
        frontSouth: true,
        frontWest: false,
        frontEast: true,
        fadeStrength: 1,
      };
  }
}

export function getOrbitWallFadeMask(
  bounds: ReturnType<typeof getOfficeLayoutBounds>,
  cameraPosition: Pick<THREE.Vector3, "x" | "z">,
): WallFadeMask {
  const offsetX = cameraPosition.x - bounds.centerX;
  const offsetZ = cameraPosition.z - bounds.centerZ;
  const absX = Math.abs(offsetX);
  const absZ = Math.abs(offsetZ);
  const dominantDistance = Math.max(absX, absZ);
  if (dominantDistance < 0.5) {
    return {
      frontNorth: false,
      frontSouth: false,
      frontWest: false,
      frontEast: false,
      fadeStrength: 0,
    };
  }

  const includeX = absX >= dominantDistance * 0.42;
  const includeZ = absZ >= dominantDistance * 0.42;
  const frontWest = includeX && offsetX < 0;
  const frontEast = includeX && offsetX > 0;
  const frontNorth = includeZ && offsetZ < 0;
  const frontSouth = includeZ && offsetZ > 0;
  const distances = [
    frontWest ? Math.abs(cameraPosition.x - bounds.minWorldX) : null,
    frontEast ? Math.abs(cameraPosition.x - bounds.maxWorldX) : null,
    frontNorth ? Math.abs(cameraPosition.z - bounds.minWorldZ) : null,
    frontSouth ? Math.abs(cameraPosition.z - bounds.maxWorldZ) : null,
  ].filter((value): value is number => value !== null);
  const nearestWallDistance =
    distances.length > 0 ? Math.min(...distances) : Number.POSITIVE_INFINITY;
  const fadeStrength = clamp01(
    (ORBIT_WALL_FADE_START_DISTANCE - nearestWallDistance) /
      (ORBIT_WALL_FADE_START_DISTANCE - ORBIT_WALL_FADE_END_DISTANCE),
  );

  return {
    frontNorth,
    frontSouth,
    frontWest,
    frontEast,
    fadeStrength,
  };
}

export function OfficeRoomShell(props: {
  floorRef: React.RefObject<THREE.Mesh | null>;
  officeFootprint: OfficeFootprint;
  officeLayout: OfficeLayoutModel;
  officeDecorSettings: OfficeSettingsModel["decor"];
  officeViewSettings: OfficeSceneViewSettings;
  officeTheme: ReturnType<typeof getOfficeTheme>;
  sceneBuilderMode: boolean;
  onBackgroundClick: (event: ThreeEvent<MouseEvent>) => void;
  onBackgroundContextMenu: (event: ThreeEvent<MouseEvent>) => void;
  /** When in fixed 2.5D, current orthographic zoom for front-wall opacity. */
  cameraZoom?: number;
  /** When in fixed 2.5D, zoom range so front walls fade from full to transparent as you zoom in. */
  zoomRange?: { minZoom: number; maxZoom: number };
  /** When in free-orbit mode, the wall side nearest the camera fades as it approaches the camera. */
  orbitWallFadeMask?: WallFadeMask;
}): JSX.Element {
  const {
    floorRef,
    officeLayout,
    officeDecorSettings,
    officeViewSettings,
    officeTheme,
    sceneBuilderMode,
    onBackgroundClick,
    onBackgroundContextMenu,
    cameraZoom,
    zoomRange,
    orbitWallFadeMask,
  } = props;
  const bounds = useMemo(() => getOfficeLayoutBounds(officeLayout), [officeLayout]);
  const wallSegments = useMemo(() => getOfficeLayoutWallSegments(officeLayout), [officeLayout]);
  const wallColor = getWallColorPreset(officeDecorSettings.wallColorId).color;
  const baseWallOpacity = sceneBuilderMode
    ? 0.22
    : officeViewSettings.viewProfile === "fixed_2_5d"
      ? 0.96
      : 1;
  const frontWalls = getFrontWallsForOpacity(officeViewSettings);
  const isFixed25 =
    officeViewSettings.viewProfile === "fixed_2_5d" && zoomRange != null && cameraZoom != null;
  const frontWallOpacity =
    isFixed25 && zoomRange
      ? Math.max(
          0.08,
          baseWallOpacity -
            (baseWallOpacity - 0.08) *
              Math.min(
                1,
                ((cameraZoom ?? zoomRange.minZoom) - zoomRange.minZoom) /
                  (zoomRange.maxZoom - zoomRange.minZoom),
              ),
        )
      : baseWallOpacity;

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: React Three Fiber mesh handles scene floor clicks, not DOM interaction semantics. */}
      <mesh
        ref={floorRef}
        position={[bounds.centerX, -0.02, bounds.centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        name="floor"
        onClick={onBackgroundClick}
        onContextMenu={onBackgroundContextMenu}
      >
        <planeGeometry args={[bounds.width, bounds.depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <OfficeInstancedFloor
        officeLayout={officeLayout}
        floorPatternId={officeDecorSettings.floorPatternId}
        sceneBuilderMode={sceneBuilderMode}
        onClick={onBackgroundClick}
        onContextMenu={onBackgroundContextMenu}
      />

      {wallSegments.map((segment) => {
        const isFront =
          (segment.id.endsWith(":north") && frontWalls.frontNorth) ||
          (segment.id.endsWith(":south") && frontWalls.frontSouth) ||
          (segment.id.endsWith(":west") && frontWalls.frontWest) ||
          (segment.id.endsWith(":east") && frontWalls.frontEast);
        const isOrbitFront =
          orbitWallFadeMask != null &&
          ((segment.id.endsWith(":north") && orbitWallFadeMask.frontNorth) ||
            (segment.id.endsWith(":south") && orbitWallFadeMask.frontSouth) ||
            (segment.id.endsWith(":west") && orbitWallFadeMask.frontWest) ||
            (segment.id.endsWith(":east") && orbitWallFadeMask.frontEast));
        const orbitWallOpacity =
          orbitWallFadeMask != null
            ? Math.max(
                ORBIT_WALL_MIN_OPACITY,
                baseWallOpacity -
                  (baseWallOpacity - ORBIT_WALL_MIN_OPACITY) * orbitWallFadeMask.fadeStrength,
              )
            : baseWallOpacity;
        const opacity =
          isFront && isFixed25
            ? frontWallOpacity
            : isOrbitFront
              ? orbitWallOpacity
              : baseWallOpacity;
        return (
          <mesh
            key={segment.id}
            position={segment.position}
            rotation={segment.rotation}
            castShadow
            receiveShadow
            name={`wall-${segment.id}`}
            ref={(mesh) => {
              if (mesh) {
                mesh.raycast = () => {};
              }
            }}
          >
            <boxGeometry args={[segment.width, WALL_HEIGHT, segment.depth]} />
            <meshStandardMaterial
              color={wallColor}
              emissive={sceneBuilderMode ? officeTheme.scene.floor : "#000000"}
              emissiveIntensity={sceneBuilderMode ? 0.05 : 0}
              transparent
              opacity={opacity}
              depthWrite={opacity >= 0.95}
            />
          </mesh>
        );
      })}
    </>
  );
}
