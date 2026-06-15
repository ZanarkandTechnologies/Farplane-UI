"use client";

/**
 * Hatch-pet compatible 2D sprite-sheet employee renderer.
 *
 * Ownership: visual-only billboard playback for Codex pet atlases inside the 3D office.
 * Inputs: renderer config, employee runtime state, and hatch-pet package manifests.
 * Outputs: a transparent Three.js sprite with UV offsets advanced by office state.
 * Side effects: fetches read-only pet manifest JSON through the Vite state bridge.
 */

import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { TOTAL_HEIGHT } from "@/constants";
import {
  buildCodexPetAssetUrl,
  buildCodexPetManifestUrl,
  isCodexPetManifest,
  isValidHatchPetAtlasSize,
  normalizeCodexPetManifest,
  type SpriteSheetCharacterManifest,
} from "./codex-pet-package";
import { selectSpriteAnimationKey } from "./sprite-state";
import type { CharacterRendererProps } from "./types";
import { EmployeeIndicatorSprite } from "../indicator-sprite";
import { getEmployeeIndicatorColor } from "../presence-visuals";
import { recordDevCharacterRendererStatus } from "../use-dev-character-renderer-probe";

const TRAVEL_BOB_AMPLITUDE = 0.08;
const TRAVEL_BOB_SPEED = 10;

export function getSpriteAnimationPhase(seed: string): number {
  return Array.from(seed).reduce((phase, character, index) => {
    return phase + character.charCodeAt(0) * (index + 1) * 0.017;
  }, 0);
}

export function getSpriteInitialFrame(seed: string, animationKey: string, frameCount: number): number {
  if (frameCount <= 1) return 0;
  const phase = getSpriteAnimationPhase(`${seed}:${animationKey}`);
  return Math.abs(Math.floor(phase * 1000)) % frameCount;
}

export function getSpriteInitialElapsedMs(
  seed: string,
  animationKey: string,
  durationsMs: number[],
): number {
  const duration = durationsMs[getSpriteInitialFrame(seed, animationKey, durationsMs.length)] ?? 140;
  const phase = getSpriteAnimationPhase(`${seed}:${animationKey}:elapsed`);
  return Math.abs(phase % 1) * duration;
}

export function getSpriteTravelBobbleY(
  animationMode: string,
  elapsedTime: number,
  seed = "",
): number {
  return animationMode === "walking"
    ? Math.abs(Math.sin(elapsedTime * TRAVEL_BOB_SPEED + getSpriteAnimationPhase(seed))) *
        TRAVEL_BOB_AMPLITUDE
    : 0;
}

type SpriteLoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; manifest: SpriteSheetCharacterManifest }
  | { status: "error"; message: string };

function useSpriteManifest(config: CharacterRendererProps["config"]): SpriteLoadState {
  const [state, setState] = useState<SpriteLoadState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    const source = config?.source;
    if (!source) {
      setState({ status: "error", message: "missing_sprite_source" });
      return;
    }
    if (source.type === "url") {
      setState({
        status: "ready",
        manifest: normalizeCodexPetManifest(
          {
            id: "url-sprite",
            displayName: "URL Sprite",
            description: "URL-provided sprite sheet.",
            spritesheetPath: source.atlasUrl,
          },
          source.atlasUrl,
        ),
      });
      return;
    }

    setState({ status: "loading" });
    fetch(buildCodexPetManifestUrl(source.petId))
      .then(async (response) => {
        if (!response.ok) throw new Error(`pet_manifest_${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (cancelled) return;
        if (!isCodexPetManifest(payload)) {
          setState({ status: "error", message: "invalid_pet_manifest" });
          return;
        }
        setState({
          status: "ready",
          manifest: normalizeCodexPetManifest(
            payload,
            buildCodexPetAssetUrl(source.petId, payload.spritesheetPath),
          ),
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: "error", message: error instanceof Error ? error.message : "pet_load_failed" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config?.source]);

  return state;
}

export function SpriteSheet2dCharacterRenderer(props: CharacterRendererProps) {
  const manifestState = useSpriteManifest(props.config);
  const { fallback: Fallback, ...fallbackProps } = props;

  useEffect(() => {
    recordDevCharacterRendererStatus({
      employeeId: props.runtime.employeeId,
      status:
        manifestState.status === "ready"
          ? "ready"
          : manifestState.status === "loading"
            ? "loading"
            : manifestState.status === "error"
              ? "error"
              : "fallback",
      message: manifestState.status === "error" ? manifestState.message : undefined,
    });
  }, [manifestState, props.runtime.employeeId]);

  if (manifestState.status !== "ready") {
    return Fallback ? <Fallback {...fallbackProps} /> : null;
  }

  return <SpriteBillboard {...props} manifest={manifestState.manifest} />;
}

function SpriteBillboard(
  props: CharacterRendererProps & { manifest: SpriteSheetCharacterManifest },
) {
  const { runtime, projection, fallback: Fallback, manifest, ...fallbackProps } = props;
  const atlasTexture = useLoader(THREE.TextureLoader, manifest.atlasUrl);
  const spriteRef = useRef<THREE.Sprite>(null);
  const elapsedRef = useRef(0);
  const frameRef = useRef(0);
  const activeKeyRef = useRef("");
  const texture = useMemo(() => atlasTexture.clone(), [atlasTexture]);
  const material = useMemo(() => new THREE.SpriteMaterial({ map: texture, transparent: true }), [texture]);
  const image = atlasTexture.image as { width?: number; height?: number } | undefined;
  const hasValidAtlasSize =
    typeof image?.width === "number" &&
    typeof image?.height === "number" &&
    isValidHatchPetAtlasSize(image.width, image.height);

  useEffect(() => {
    recordDevCharacterRendererStatus({
      employeeId: runtime.employeeId,
      status: hasValidAtlasSize ? "ready" : "fallback",
      message: hasValidAtlasSize ? undefined : "invalid_hatch_pet_atlas_size",
    });
  }, [hasValidAtlasSize, runtime.employeeId]);

  useEffect(() => {
    texture.image = atlasTexture.image;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.repeat.set(1 / manifest.grid.columns, 1 / manifest.grid.rows);
    texture.needsUpdate = true;
  }, [atlasTexture.image, manifest.grid.columns, manifest.grid.rows, texture]);

  useEffect(() => {
    return () => {
      texture.dispose();
      material.dispose();
    };
  }, [material, texture]);

  useFrame((state, delta) => {
    const key = selectSpriteAnimationKey({
      animationMode: runtime.animationMode,
      movementDirection: runtime.movementDirection,
      activityState: runtime.activityState,
    });
    const animation = manifest.animations[key] ?? manifest.animations.idle;
    if (activeKeyRef.current !== key) {
      activeKeyRef.current = key;
      frameRef.current = getSpriteInitialFrame(runtime.employeeId, key, animation.frames);
      elapsedRef.current = getSpriteInitialElapsedMs(runtime.employeeId, key, animation.durationsMs);
    }

    elapsedRef.current += delta * 1000;
    const currentDuration = animation.durationsMs[frameRef.current] ?? animation.durationsMs[0] ?? 140;
    if (elapsedRef.current >= currentDuration) {
      elapsedRef.current = 0;
      frameRef.current = (frameRef.current + 1) % animation.frames;
    }

    texture.offset.set(
      frameRef.current / manifest.grid.columns,
      1 - (animation.row + 1) / manifest.grid.rows,
    );

    if (spriteRef.current) {
      spriteRef.current.position.y = getSpriteTravelBobbleY(
        runtime.animationMode,
        state.clock.elapsedTime,
        runtime.employeeId,
      );
    }
  });

  const opacity = projection ? 0.52 : (props.presenceVisual?.bodyOpacity ?? 1);
  material.opacity = opacity;
  material.color.set(projection ? "#67e8f9" : "#ffffff");

  if (!hasValidAtlasSize) {
    return Fallback ? <Fallback {...fallbackProps} runtime={runtime} projection={projection} /> : null;
  }

  const indicatorColor = getEmployeeIndicatorColor({
    teamId: props.teamId,
    activityState: runtime.activityState,
  });

  return (
    <group>
      <sprite
        ref={spriteRef}
        material={material}
        scale={[
          (manifest.cell.width / manifest.cell.height) * TOTAL_HEIGHT * manifest.scale,
          TOTAL_HEIGHT * manifest.scale,
          1,
        ]}
        position={[0, 0, 0]}
      />
      {!projection ? (
        <SpritePresenceIndicator
          color={indicatorColor}
          persistent={props.presenceVisual?.kind === "persistent"}
          opacity={props.presenceVisual?.bodyOpacity ?? 1}
        />
      ) : null}
    </group>
  );
}

function SpritePresenceIndicator({
  color,
  persistent,
  opacity,
}: {
  color: string;
  persistent: boolean;
  opacity: number;
}) {
  return (
    <EmployeeIndicatorSprite
      icon={persistent ? "heart" : "diamond"}
      color={color}
      opacity={opacity}
      position={[0, TOTAL_HEIGHT * 0.82, 0.05]}
      scale={0.34}
    />
  );
}
