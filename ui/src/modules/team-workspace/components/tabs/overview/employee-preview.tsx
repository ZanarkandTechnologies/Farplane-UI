import { Box } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { type ReactElement, useMemo } from "react";
import {
  BODY_HEIGHT,
  BODY_WIDTH,
  HAIR_HEIGHT,
  HAIR_WIDTH,
  HEAD_HEIGHT,
  HEAD_WIDTH,
  LEG_HEIGHT,
  TOTAL_HEIGHT,
} from "@/constants";
import { type AvatarPalette, resolvePreviewPalette } from "./overview-helpers";

function EmployeePreviewMesh({ palette }: { palette: AvatarPalette }): ReactElement {
  const baseY = -TOTAL_HEIGHT / 2;
  return (
    <group position={[0, -0.18, 0]} rotation={[0.08, -0.38, 0]}>
      <Box
        args={[BODY_WIDTH, LEG_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.pants} />
      </Box>
      <Box
        args={[BODY_WIDTH, BODY_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.shirt} />
      </Box>
      <Box
        args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.skin} />
      </Box>
      <Box
        args={[HAIR_WIDTH, HAIR_HEIGHT, HAIR_WIDTH]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.hair} />
      </Box>
    </group>
  );
}

export function MiniEmployeePreview({ seed }: { seed: string }): ReactElement {
  const palette = useMemo(() => resolvePreviewPalette(seed), [seed]);

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="h-28 w-28">
        <Canvas camera={{ position: [0, 0.5, 3.1], fov: 24 }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[2, 3, 4]} intensity={2.1} />
          <directionalLight position={[-2, 1.5, 2]} intensity={0.7} />
          <group scale={1.65}>
            <EmployeePreviewMesh palette={palette} />
          </group>
        </Canvas>
      </div>
    </div>
  );
}
