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

import type { getOfficeTheme } from '@/config/office-theme';
import { HALF_FLOOR } from '@/constants';

export function OfficeLighting(props: {
    officeTheme: ReturnType<typeof getOfficeTheme>;
    sceneBuilderMode: boolean;
}): JSX.Element {
    const { officeTheme, sceneBuilderMode } = props;

    return (
        <>
            <ambientLight intensity={0.9} color={officeTheme.lighting.ambient} />
            <directionalLight
                position={[0, 20, 5]}
                intensity={1.5}
                color={officeTheme.lighting.directional}
                castShadow
                shadow-mapSize-width={sceneBuilderMode ? 1024 : 2048}
                shadow-mapSize-height={sceneBuilderMode ? 1024 : 2048}
                shadow-camera-far={50}
                shadow-camera-left={-HALF_FLOOR - 5}
                shadow-camera-right={HALF_FLOOR + 5}
                shadow-camera-top={HALF_FLOOR + 5}
                shadow-camera-bottom={-HALF_FLOOR - 5}
            />
            <pointLight position={[-10, 10, -10]} intensity={0.5} color={officeTheme.lighting.point} />
            <pointLight position={[10, 10, 10]} intensity={0.5} color={officeTheme.lighting.point} />
        </>
    );
}
