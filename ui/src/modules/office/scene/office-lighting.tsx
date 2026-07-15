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

import type { getOfficeTheme } from "@/config/office-theme";
import { getOfficeLayoutBounds, type OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import type { OfficeSceneViewSettings } from "./view-profile";

export function OfficeLighting(props: {
  officeTheme: ReturnType<typeof getOfficeTheme>;
  officeLayout: OfficeLayoutModel;
  officeViewSettings: OfficeSceneViewSettings;
}): React.JSX.Element {
  const { officeTheme, officeLayout, officeViewSettings } = props;
  const bounds = getOfficeLayoutBounds(officeLayout);
  const isIsometricView = officeViewSettings.viewProfile === "fixed_2_5d";

  return (
    <>
      <ambientLight intensity={isIsometricView ? 0.84 : 0.82} color={officeTheme.lighting.ambient} />
      <directionalLight
        position={isIsometricView ? [18, 24, 18] : [0, 20, 5]}
        intensity={isIsometricView ? 1.28 : 1.4}
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
      <pointLight
        position={[bounds.minWorldX + 4, 4.6, bounds.minWorldZ + 4]}
        intensity={isIsometricView ? 4.2 : 1.2}
        color={officeTheme.lighting.point}
        distance={14}
        decay={1.4}
      />
      <pointLight
        position={[bounds.maxWorldX - 4, 4.6, bounds.minWorldZ + 4]}
        intensity={isIsometricView ? 4.2 : 1.2}
        color={officeTheme.lighting.point}
        distance={14}
        decay={1.4}
      />
      <pointLight
        position={[bounds.centerX, 5.2, bounds.centerZ]}
        intensity={isIsometricView ? 3.1 : 1.4}
        color="#e4a96d"
        distance={12}
        decay={1.8}
      />
      {isIsometricView
          ? [
            [0, -8],
            [8, 0],
            [0, 8],
            [-8, 0],
          ].map(([offsetX, offsetZ]) => (
            <pointLight
              key={`${offsetX}:${offsetZ}`}
              position={[bounds.centerX + offsetX, 3.8, bounds.centerZ + offsetZ]}
              intensity={3.6}
              color="#efb06f"
              distance={8}
              decay={1.45}
            />
          ))
        : null}
    </>
  );
}
