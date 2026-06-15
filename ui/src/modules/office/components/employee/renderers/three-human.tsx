"use client";

/**
 * Default Three.js employee character renderer.
 *
 * Ownership: the existing blocky office employee visual body.
 * Inputs: palette, role/decor flags, profile image, and appearance options from the employee shell.
 * Outputs: mesh hierarchy for the employee body only.
 * Side effects: none; locomotion, selection, labels, and context actions stay in `Employee`.
 */

import { Box } from "@react-three/drei";
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
import {
  CeoCrown,
  LobsterAntennae,
  LobsterClaws,
  LobsterEyes,
  PmGoggleHat,
  TeamPlumbob,
} from "../Decorations";
import { ProfileHead } from "../ProfileHead";
import type { CharacterRendererProps } from "./types";

export function ThreeHumanCharacterRenderer({
  colors,
  profileImageUrl,
  isCEO,
  isSupervisor,
  teamId,
  activityState,
  useCompactOverlayMode,
  projection = false,
  presenceVisual,
  petType,
  clothesStyle,
}: CharacterRendererProps) {
  const baseY = -TOTAL_HEIGHT / 2;
  const bodyOpacity = projection ? 0.48 : (presenceVisual?.bodyOpacity ?? 1);
  const materialProps = bodyOpacity < 1 ? { transparent: true, opacity: bodyOpacity } : {};
  const projectionHeadColor = projection ? "#67e8f9" : colors.skin;
  const projectionHairColor = projection ? "#a5f3fc" : colors.hair;
  const projectionShirtColor = projection ? "#22d3ee" : colors.shirt;
  const projectionPantsColor = projection ? "#0f766e" : colors.pants;

  return (
    <group>
      <Box
        args={[BODY_WIDTH, LEG_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT / 2, 0]}
        castShadow={!projection}
      >
        <meshStandardMaterial color={projectionPantsColor} {...materialProps} />
      </Box>
      <Box
        args={[BODY_WIDTH, BODY_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT / 2, 0]}
        castShadow={!projection}
      >
        <meshStandardMaterial color={projectionShirtColor} {...materialProps} />
      </Box>

      {clothesStyle === "techBro" && !projection ? (
        <Box
          args={[BODY_WIDTH * 0.9, BODY_HEIGHT * 0.5, BODY_WIDTH * 0.35]}
          position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT * 0.85, -BODY_WIDTH * 0.42]}
          castShadow
        >
          <meshStandardMaterial color={colors.shirt} {...materialProps} />
        </Box>
      ) : null}

      {profileImageUrl && profileImageUrl.trim().length > 0 && !projection ? (
        <ProfileHead
          imageUrl={profileImageUrl}
          position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
          skinColor={colors.skin}
          hairColor={colors.hair}
          useCompactOverlayMode={useCompactOverlayMode}
        />
      ) : (
        <Box
          args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]}
          position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
          castShadow={!projection}
        >
          <meshStandardMaterial color={projectionHeadColor} {...materialProps} />
        </Box>
      )}

      <group position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT / 2, 0]}>
        <Box args={[HAIR_WIDTH, HAIR_HEIGHT, HAIR_WIDTH]} castShadow={!projection}>
          <meshStandardMaterial color={projectionHairColor} {...materialProps} />
        </Box>
        {isCEO ? <CeoCrown /> : isSupervisor ? <PmGoggleHat /> : null}
      </group>

      <LobsterClaws color={projectionShirtColor} />
      <LobsterAntennae />
      <LobsterEyes />
      {!projection ? (
        <TeamPlumbob
          teamId={teamId}
          activityState={activityState}
          persistent={presenceVisual?.kind === "persistent"}
          indicatorOpacity={presenceVisual?.bodyOpacity ?? 1}
        />
      ) : null}
      {petType && !projection && petType !== "none" ? <OfficePetMesh petType={petType} /> : null}
    </group>
  );
}

function OfficePetMesh({
  petType,
}: {
  petType: "dog" | "cat" | "goldfish" | "rabbit" | "lobster";
}) {
  const baseY = -TOTAL_HEIGHT / 2 + LEG_HEIGHT;
  if (petType === "dog") {
    return (
      <group position={[BODY_WIDTH * 0.9, baseY, BODY_WIDTH * 0.25]}>
        <Box args={[0.22, 0.14, 0.36]} position={[0, 0.07, 0]} castShadow>
          <meshStandardMaterial color="#8D6E63" />
        </Box>
        <Box args={[0.16, 0.12, 0.18]} position={[0, 0.18, 0.12]} castShadow>
          <meshStandardMaterial color="#5D4037" />
        </Box>
      </group>
    );
  }
  if (petType === "cat") {
    return (
      <group position={[BODY_WIDTH * 0.9, baseY, BODY_WIDTH * 0.25]}>
        <Box args={[0.22, 0.14, 0.36]} position={[0, 0.07, 0]} castShadow>
          <meshStandardMaterial color="#B0BEC5" />
        </Box>
        <Box args={[0.16, 0.12, 0.18]} position={[0, 0.18, 0.12]} castShadow>
          <meshStandardMaterial color="#78909C" />
        </Box>
      </group>
    );
  }
  if (petType === "goldfish") {
    return (
      <group position={[BODY_WIDTH * 0.1, baseY + 0.12, -BODY_WIDTH * 0.9]}>
        <Box args={[0.3, 0.2, 0.3]} position={[0, 0.1, 0]} castShadow>
          <meshStandardMaterial color="#B3E5FC" opacity={0.85} transparent />
        </Box>
        <Box args={[0.1, 0.06, 0.18]} position={[0, 0.13, 0]} castShadow>
          <meshStandardMaterial color="#FF9800" />
        </Box>
      </group>
    );
  }
  if (petType === "rabbit") {
    return (
      <group position={[BODY_WIDTH * 0.9, baseY, BODY_WIDTH * 0.2]}>
        <Box args={[0.2, 0.14, 0.32]} position={[0, 0.07, 0]} castShadow>
          <meshStandardMaterial color="#E0E0E0" />
        </Box>
        <Box args={[0.12, 0.2, 0.12]} position={[-0.06, 0.22, 0.08]} castShadow>
          <meshStandardMaterial color="#E0E0E0" />
        </Box>
        <Box args={[0.12, 0.2, 0.12]} position={[0.06, 0.22, 0.08]} castShadow>
          <meshStandardMaterial color="#E0E0E0" />
        </Box>
        <Box args={[0.06, 0.05, 0.08]} position={[0, 0.06, -0.18]} castShadow>
          <meshStandardMaterial color="#BDBDBD" />
        </Box>
      </group>
    );
  }
  if (petType === "lobster") {
    return (
      <group position={[BODY_WIDTH * 0.85, baseY, BODY_WIDTH * 0.25]}>
        <Box args={[0.22, 0.1, 0.4]} position={[0, 0.05, 0]} castShadow>
          <meshStandardMaterial color="#D84315" />
        </Box>
        <Box args={[0.08, 0.06, 0.14]} position={[-0.1, 0.06, 0.2]} castShadow>
          <meshStandardMaterial color="#D84315" />
        </Box>
        <Box args={[0.08, 0.06, 0.14]} position={[0.1, 0.06, 0.2]} castShadow>
          <meshStandardMaterial color="#D84315" />
        </Box>
        <Box args={[0.06, 0.05, 0.12]} position={[0, 0.05, -0.22]} castShadow>
          <meshStandardMaterial color="#BF360C" />
        </Box>
      </group>
    );
  }
  return null;
}
