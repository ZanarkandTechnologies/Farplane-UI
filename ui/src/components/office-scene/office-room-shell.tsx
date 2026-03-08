/**
 * OFFICE ROOM SHELL
 * =================
 * Static floor and wall geometry for the office container.
 *
 * KEY CONCEPTS:
 * - Room chrome is static presentation and should not carry scene orchestration logic.
 *
 * USAGE:
 * - Render inside `SceneContents` and pass the floor ref plus background click handler.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

import { Box } from '@react-three/drei';
import { FLOOR_SIZE, HALF_FLOOR, WALL_HEIGHT, WALL_THICKNESS } from '@/constants';
import type { getOfficeTheme } from '@/config/office-theme';
import type { ThreeEvent } from '@react-three/fiber';
import type * as THREE from 'three';

export function OfficeRoomShell(props: {
    floorRef: React.RefObject<THREE.Mesh | null>;
    officeTheme: ReturnType<typeof getOfficeTheme>;
    onBackgroundClick: (event: ThreeEvent<MouseEvent>) => void;
}): JSX.Element {
    const { floorRef, officeTheme, onBackgroundClick } = props;

    return (
        <>
            <Box
                ref={floorRef}
                args={[FLOOR_SIZE, WALL_THICKNESS, FLOOR_SIZE]}
                position={[0, -WALL_THICKNESS / 2, 0]}
                receiveShadow
                name="floor"
                onClick={onBackgroundClick}
            >
                <meshStandardMaterial color={officeTheme.scene.floor} />
            </Box>

            <Box
                args={[FLOOR_SIZE, WALL_HEIGHT, WALL_THICKNESS]}
                position={[0, WALL_HEIGHT / 2, -HALF_FLOOR]}
                castShadow
                receiveShadow
                name="wall-back"
                onClick={onBackgroundClick}
            >
                <meshStandardMaterial color={officeTheme.scene.walls} />
            </Box>
            <Box
                args={[FLOOR_SIZE, WALL_HEIGHT, WALL_THICKNESS]}
                position={[0, WALL_HEIGHT / 2, HALF_FLOOR]}
                castShadow
                receiveShadow
                name="wall-front"
                onClick={onBackgroundClick}
            >
                <meshStandardMaterial color={officeTheme.scene.walls} />
            </Box>
            <Box
                args={[WALL_THICKNESS, WALL_HEIGHT, FLOOR_SIZE + WALL_THICKNESS]}
                position={[-HALF_FLOOR, WALL_HEIGHT / 2, 0]}
                castShadow
                receiveShadow
                name="wall-left"
                onClick={onBackgroundClick}
            >
                <meshStandardMaterial color={officeTheme.scene.walls} />
            </Box>
            <Box
                args={[WALL_THICKNESS, WALL_HEIGHT, FLOOR_SIZE + WALL_THICKNESS]}
                position={[HALF_FLOOR, WALL_HEIGHT / 2, 0]}
                castShadow
                receiveShadow
                name="wall-right"
                onClick={onBackgroundClick}
            >
                <meshStandardMaterial color={officeTheme.scene.walls} />
            </Box>
        </>
    );
}
