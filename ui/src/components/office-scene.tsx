'use client';

/**
 * OFFICE SCENE
 * ============
 * Public canvas shell for the 3D office experience.
 *
 * KEY CONCEPTS:
 * - This file stays thin and owns only the canvas shell plus external dialog mounting.
 * - Scene internals live under `components/office-scene/` so startup, rendering, and data shaping stay modular.
 *
 * USAGE:
 * - Render `OfficeScene` anywhere the office 3D experience should appear.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0150
 */

import { memo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useAppStore } from '@/lib/app-store';
import { ViewComputerDialog } from '@/features/remote-cua-system/components/view-computer-dialog';
import { SceneContents } from '@/components/office-scene/scene-contents';
import { useOfficeSceneBackground } from '@/components/office-scene/use-office-scene-camera';
import type { OfficeSceneProps } from '@/components/office-scene/types';

const OfficeScene = memo((props: OfficeSceneProps) => {
    const background = useOfficeSceneBackground();
    const viewComputerEmployeeId = useAppStore((state) => state.viewComputerEmployeeId);
    const viewComputerInitialProjectId = useAppStore((state) => state.viewComputerInitialProjectId);
    const setViewComputerEmployeeId = useAppStore((state) => state.setViewComputerEmployeeId);

    return (
        <>
            <Canvas
                shadows
                camera={{ position: [0, 25, 30], fov: 50 }}
                style={{ background, transition: 'background 0.3s ease' }}
            >
                <SceneContents {...props} />
            </Canvas>

            {viewComputerEmployeeId ? (
                <ViewComputerDialog
                    employeeId={viewComputerEmployeeId}
                    open={Boolean(viewComputerEmployeeId)}
                    onOpenChange={(open) => {
                        if (!open) {
                            setViewComputerEmployeeId(null);
                        }
                    }}
                    initialProjectId={viewComputerInitialProjectId}
                />
            ) : null}
        </>
    );
});

OfficeScene.displayName = 'OfficeScene';

export default OfficeScene;
export type { OfficeSceneProps };
