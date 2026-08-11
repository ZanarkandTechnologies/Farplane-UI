/**
 * OFFICE LIGHTING
 * ===============
 * Static office light rig for the 3D scene.
 *
 * KEY CONCEPTS:
 * - Lighting is presentation-only and should stay separate from scene bootstrap/data logic.
 *
 * USAGE:
 * - Render inside `SceneContents`.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

import type { getOfficeTheme, OfficeDioramaTheme } from "@/config/office-theme";
import { getDepartmentIslandGeometry } from "@/modules/office/lib/department-island-layout";
import { getOfficeLayoutBounds, type OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import type { OfficeSceneViewSettings } from "./view-profile";

export function OfficeLighting(props: {
  officeTheme: ReturnType<typeof getOfficeTheme>;
  dioramaTheme: OfficeDioramaTheme;
  officeLayout: OfficeLayoutModel;
  officeViewSettings: OfficeSceneViewSettings;
  archipelagoMode?: boolean;
}): React.JSX.Element {
  const {
    officeTheme,
    dioramaTheme,
    officeLayout,
    officeViewSettings,
    archipelagoMode = false,
  } = props;
  const bounds = getOfficeLayoutBounds(officeLayout);
  const isIsometricView = officeViewSettings.viewProfile === "fixed_2_5d";

  return (
    <>
      <ambientLight
        intensity={
          archipelagoMode ? dioramaTheme.lighting.ambientIntensity : isIsometricView ? 0.84 : 0.82
        }
        color={officeTheme.lighting.ambient}
      />
      <directionalLight
        position={archipelagoMode ? [18, 30, 22] : isIsometricView ? [18, 24, 18] : [0, 20, 5]}
        intensity={
          archipelagoMode
            ? dioramaTheme.lighting.directionalIntensity
            : isIsometricView
              ? 1.28
              : 1.4
        }
        color={officeTheme.lighting.directional}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={bounds.minWorldX - 5}
        shadow-camera-right={bounds.maxWorldX + 5}
        shadow-camera-top={bounds.maxWorldZ + 5}
        shadow-camera-bottom={bounds.minWorldZ - 5}
      />
      {!archipelagoMode ? (
        <pointLight
          position={[bounds.minWorldX + 4, 4.6, bounds.minWorldZ + 4]}
          intensity={isIsometricView ? 2.4 : 1.2}
          color={officeTheme.lighting.point}
          distance={14}
          decay={1.4}
        />
      ) : null}
      {!archipelagoMode ? (
        <pointLight
          position={[bounds.maxWorldX - 4, 4.6, bounds.minWorldZ + 4]}
          intensity={isIsometricView ? 2.4 : 1.2}
          color={officeTheme.lighting.point}
          distance={14}
          decay={1.4}
        />
      ) : null}
      {!archipelagoMode ? (
        <pointLight
          position={[bounds.centerX, 5.2, bounds.centerZ]}
          intensity={isIsometricView ? 1.8 : 1.4}
          color={officeTheme.lighting.directional}
          distance={12}
          decay={1.8}
        />
      ) : null}
      {!archipelagoMode && isIsometricView
        ? [
            [0, -8],
            [8, 0],
            [0, 8],
            [-8, 0],
          ].map(([offsetX, offsetZ]) => (
            <pointLight
              key={`${offsetX}:${offsetZ}`}
              position={[bounds.centerX + offsetX, 3.8, bounds.centerZ + offsetZ]}
              intensity={2}
              color={officeTheme.lighting.point}
              distance={8}
              decay={1.45}
            />
          ))
        : null}
      {archipelagoMode
        ? getDepartmentIslandGeometry().map((island) => (
            <pointLight
              key={`department-work-light-${island.id}`}
              position={[island.center[0], 2.6, island.center[1]]}
              intensity={dioramaTheme.lighting.workLightIntensity}
              color={dioramaTheme.lighting.workLight}
              distance={4.8}
              decay={1.7}
            />
          ))
        : null}
    </>
  );
}
