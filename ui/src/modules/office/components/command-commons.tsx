/**
 * COMMAND COMMONS
 * ===============
 * Procedural, generated focal table for the automatic office composition.
 * It receives only a transform, emits one obstacle-sized group, and has no
 * persistence or interaction side effects.
 */

import { Box, Cylinder } from "@react-three/drei";
import { COMPUTER_HEIGHT, DESK_HEIGHT } from "@/constants";
import { OFFICE_LANDMARK_THEME } from "@/config/office-theme";
import {
  COMMAND_COMMONS_FRAME,
  COMMAND_COMMONS_SCALE,
} from "@/modules/office/lib/command-commons-geometry";

const M = OFFICE_LANDMARK_THEME.materials;

export function getCommandCommonsStationTransforms(): Array<{
  position: [number, number, number];
  rotationY: number;
}> {
  return [-2.65, -0.9, 0.9, 2.65].flatMap((x) => [
    { position: [x, DESK_HEIGHT + 0.25, -2.08] as [number, number, number], rotationY: 0 },
    { position: [x, DESK_HEIGHT + 0.25, 2.08] as [number, number, number], rotationY: Math.PI },
  ]);
}

const COMMAND_SCREEN_COLORS = [
  "#244d50",
  "#315c52",
  "#21445a",
  "#3a685c",
  "#28606b",
  "#315e72",
  "#3f6b55",
  "#245361",
  "#2c5364",
  "#376657",
  "#27586a",
  "#3d695e",
] as const;

export default function CommandCommons({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group
      position={position}
      rotation={rotation}
      scale={[COMMAND_COMMONS_SCALE, 1, COMMAND_COMMONS_SCALE]}
      name="command-commons"
    >
      <pointLight position={[0, 4.2, 0]} intensity={3.8} color="#e8a25d" distance={8} decay={1.45} />
      <group name="command-commons-contained-architecture">
        {[-1, 1].flatMap((xSign) =>
          [-1, 1].map((zSign) => (
            <Box
              key={`frame-post-${xSign}-${zSign}`}
              args={[
                COMMAND_COMMONS_FRAME.beamThickness,
                COMMAND_COMMONS_FRAME.height,
                COMMAND_COMMONS_FRAME.beamThickness,
              ]}
              position={[
                xSign * COMMAND_COMMONS_FRAME.postX,
                COMMAND_COMMONS_FRAME.height / 2,
                zSign * COMMAND_COMMONS_FRAME.postZ,
              ]}
              castShadow
            >
              <meshStandardMaterial color={M.darkWalnut} roughness={0.7} />
            </Box>
          )),
        )}
        {[-1, 1].map((zSign) => (
          <group key={`frame-beam-${zSign}`}>
            <Box
              args={[
                COMMAND_COMMONS_FRAME.postX * 2,
                COMMAND_COMMONS_FRAME.beamThickness,
                COMMAND_COMMONS_FRAME.beamThickness,
              ]}
              position={[0, COMMAND_COMMONS_FRAME.height, zSign * COMMAND_COMMONS_FRAME.postZ]}
              castShadow
            >
              <meshStandardMaterial color={M.darkWalnut} roughness={0.68} />
            </Box>
            <Box
              args={[COMMAND_COMMONS_FRAME.postX * 1.72, 0.035, 0.055]}
              position={[0, COMMAND_COMMONS_FRAME.height - 0.08, zSign * COMMAND_COMMONS_FRAME.postZ]}
            >
              <meshStandardMaterial color="#bd8654" emissive="#8f512d" emissiveIntensity={0.42} />
            </Box>
          </group>
        ))}
        {[-1, 1].map((xSign) => (
          <Box
            key={`frame-crossbeam-${xSign}`}
            args={[
              COMMAND_COMMONS_FRAME.beamThickness,
              COMMAND_COMMONS_FRAME.beamThickness,
              COMMAND_COMMONS_FRAME.postZ * 2,
            ]}
            position={[xSign * COMMAND_COMMONS_FRAME.postX, COMMAND_COMMONS_FRAME.height, 0]}
            castShadow
          >
            <meshStandardMaterial color={M.darkWalnut} roughness={0.68} />
          </Box>
        ))}
      </group>
      <Box args={[8.75, 0.24, 5.85]} position={[0, DESK_HEIGHT, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#4a3325" roughness={0.66} />
      </Box>
      <Box args={[8.3, 0.055, 5.42]} position={[0, DESK_HEIGHT + 0.145, 0]} receiveShadow>
        <meshStandardMaterial color="#654833" roughness={0.58} />
      </Box>
      {[[-3.35, -2.05], [3.35, -2.05], [-3.35, 2.05], [3.35, 2.05]].map(([x, z]) => (
        <Cylinder key={`${x}:${z}`} args={[0.2, 0.28, DESK_HEIGHT, 16]} position={[x, DESK_HEIGHT / 2, z]} castShadow>
          <meshStandardMaterial color={M.darkMetal} roughness={0.55} metalness={0.35} />
        </Cylinder>
      ))}
      {COMMAND_SCREEN_COLORS.map((color, index) => {
        const column = index % 4;
        const row = Math.floor(index / 4);
        return (
          <Box
            key={color}
            args={[1.72, 0.07, 1.38]}
            position={[-2.73 + column * 1.82, DESK_HEIGHT + 0.21, -1.46 + row * 1.46]}
            castShadow
          >
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.34} roughness={0.38} metalness={0.16} />
          </Box>
        );
      })}
      {getCommandCommonsStationTransforms().map((station, index) => (
        <group key={index} position={station.position} rotation={[0, station.rotationY, 0]}>
          <Box args={[0.68, COMPUTER_HEIGHT * 0.72, 0.055]} position={[0, COMPUTER_HEIGHT * 0.36, 0]} castShadow>
            <meshStandardMaterial color={M.inactiveScreen} roughness={0.32} metalness={0.12} />
          </Box>
          <Box args={[0.12, 0.18, 0.12]} position={[0, -0.07, 0]}>
            <meshStandardMaterial color={M.darkMetal} roughness={0.5} />
          </Box>
        </group>
      ))}
      {[-2.86, 2.86].map((z) => (
        <Box key={`edge-rail-z-${z}`} args={[8.9, 0.24, 0.18]} position={[0, DESK_HEIGHT + 0.31, z]} castShadow>
          <meshStandardMaterial color="#754d33" roughness={0.58} />
        </Box>
      ))}
      {[-4.32, 4.32].map((x) => (
        <Box key={`edge-rail-x-${x}`} args={[0.18, 0.24, 5.55]} position={[x, DESK_HEIGHT + 0.31, 0]} castShadow>
          <meshStandardMaterial color="#754d33" roughness={0.58} />
        </Box>
      ))}
      {[-2.65, -0.9, 0.9, 2.65].flatMap((x) =>
        [-2.9, 2.9].map((z) => (
          <group key={`chair-${x}-${z}`} position={[x, 0, z]} rotation={[0, z > 0 ? Math.PI : 0, 0]}>
            <Box args={[0.56, 0.12, 0.52]} position={[0, 0.46, 0]} castShadow>
              <meshStandardMaterial color="#2f302e" roughness={0.82} />
            </Box>
            <Box args={[0.56, 0.72, 0.1]} position={[0, 0.76, 0.24]} castShadow>
              <meshStandardMaterial color="#373632" roughness={0.8} />
            </Box>
          </group>
        )),
      )}
      {[-4.02, 4.02].flatMap((x) =>
        [-1.35, 1.35].map((z) => (
          <group key={`side-chair-${x}-${z}`} position={[x, 0, z]}>
            <Box args={[0.52, 0.12, 0.56]} position={[0, 0.46, 0]} castShadow>
              <meshStandardMaterial color="#2f302e" roughness={0.82} />
            </Box>
            <Box args={[0.1, 0.72, 0.56]} position={[x > 0 ? 0.24 : -0.24, 0.76, 0]} castShadow>
              <meshStandardMaterial color="#373632" roughness={0.8} />
            </Box>
          </group>
        )),
      )}
      <Box args={[7.82, 0.06, 0.08]} position={[0, DESK_HEIGHT + 0.19, -2.49]}>
        <meshStandardMaterial color="#91694b" emissive="#5c3524" emissiveIntensity={0.18} />
      </Box>
      <Box args={[7.82, 0.06, 0.08]} position={[0, DESK_HEIGHT + 0.19, 2.49]}>
        <meshStandardMaterial color="#91694b" emissive="#5c3524" emissiveIntensity={0.18} />
      </Box>
    </group>
  );
}
