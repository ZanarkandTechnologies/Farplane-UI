"use client";

/**
 * Hatch-pet compatible 2D sprite-sheet employee renderer.
 *
 * Ownership: visual-only billboard playback for Codex pet atlases inside the 3D office.
 * Inputs: renderer config, employee runtime state, and hatch-pet package manifests.
 * Outputs: a transparent Three.js sprite with UV offsets advanced by office state.
 * Side effects: fetches read-only pet manifest JSON through the Vite state bridge.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { TOTAL_HEIGHT } from "@/constants";
import { EmployeeIndicatorSprite } from "../indicator-sprite";
import { getEmployeeIndicatorColor } from "../presence-visuals";
import { recordDevCharacterRendererStatus } from "../use-dev-character-renderer-probe";
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

const TRAVEL_BOB_AMPLITUDE = 0.08;
const TRAVEL_BOB_SPEED = 10;

export function getSpriteAnimationPhase(seed: string): number {
  return Array.from(seed).reduce((phase, character, index) => {
    return phase + character.charCodeAt(0) * (index + 1) * 0.017;
  }, 0);
}

export function getSpriteInitialFrame(
  seed: string,
  animationKey: string,
  frameCount: number,
): number {
  if (frameCount <= 1) return 0;
  const phase = getSpriteAnimationPhase(`${seed}:${animationKey}`);
  return Math.abs(Math.floor(phase * 1000)) % frameCount;
}

export function getSpriteInitialElapsedMs(
  seed: string,
  animationKey: string,
  durationsMs: number[],
): number {
  const duration =
    durationsMs[getSpriteInitialFrame(seed, animationKey, durationsMs.length)] ?? 140;
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

const manifestRequestCache = new Map<string, Promise<SpriteSheetCharacterManifest>>();
const atlasTextureRequestCache = new Map<string, Promise<THREE.Texture>>();

function loadCodexPetManifest(petId: string): Promise<SpriteSheetCharacterManifest> {
  const manifestUrl = buildCodexPetManifestUrl(petId);
  const cached = manifestRequestCache.get(manifestUrl);
  if (cached) return cached;

  const request = fetch(manifestUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error(`pet_manifest_${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then((payload) => {
      if (!isCodexPetManifest(payload)) throw new Error("invalid_pet_manifest");
      return normalizeCodexPetManifest(
        payload,
        buildCodexPetAssetUrl(petId, payload.spritesheetPath),
      );
    })
    .catch((error) => {
      manifestRequestCache.delete(manifestUrl);
      throw error;
    });
  manifestRequestCache.set(manifestUrl, request);
  return request;
}

function useSpriteManifest(config: CharacterRendererProps["config"]): SpriteLoadState {
  const [state, setState] = useState<SpriteLoadState>({ status: "idle" });
  const source = config?.source;
  const sourceType = source?.type;
  const petId = source?.type === "codex-pet" ? source.petId : undefined;
  const atlasUrl = source?.type === "url" ? source.atlasUrl : undefined;

  useEffect(() => {
    let cancelled = false;
    if (!sourceType) {
      setState({ status: "error", message: "missing_sprite_source" });
      return;
    }
    if (sourceType === "url" && atlasUrl) {
      setState({
        status: "ready",
        manifest: normalizeCodexPetManifest(
          {
            id: "url-sprite",
            displayName: "URL Sprite",
            description: "URL-provided sprite sheet.",
            spritesheetPath: atlasUrl,
          },
          atlasUrl,
        ),
      });
      return;
    }
    if (!petId) {
      setState({ status: "error", message: "missing_sprite_source" });
      return;
    }

    setState({ status: "loading" });
    void loadCodexPetManifest(petId)
      .then((manifest) => {
        if (cancelled) return;
        setState({ status: "ready", manifest });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "pet_load_failed",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [atlasUrl, petId, sourceType]);

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
    if (manifestState.status !== "error" && props.suppressLoadingFallback) return null;
    return Fallback ? <Fallback {...fallbackProps} /> : null;
  }

  return <SpriteBillboard {...props} manifest={manifestState.manifest} />;
}

type AtlasTextureState =
  | { status: "loading" }
  | { status: "ready"; texture: THREE.Texture }
  | { status: "error"; message: string };

function useAtlasTexture(atlasUrl: string): AtlasTextureState {
  const [state, setState] = useState<AtlasTextureState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    let request = atlasTextureRequestCache.get(atlasUrl);
    if (!request) {
      request = new THREE.TextureLoader().loadAsync(atlasUrl).catch((error) => {
        atlasTextureRequestCache.delete(atlasUrl);
        throw error;
      });
      atlasTextureRequestCache.set(atlasUrl, request);
    }
    void request
      .then((texture) => {
        if (!cancelled) setState({ status: "ready", texture });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "pet_atlas_load_failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [atlasUrl]);

  return state;
}

function SpriteBillboard(
  props: CharacterRendererProps & { manifest: SpriteSheetCharacterManifest },
) {
  const atlasState = useAtlasTexture(props.manifest.atlasUrl);
  const { fallback: Fallback, ...fallbackProps } = props;

  useEffect(() => {
    if (atlasState.status !== "error") return;
    recordDevCharacterRendererStatus({
      employeeId: props.runtime.employeeId,
      status: "error",
      message: atlasState.message,
    });
  }, [atlasState, props.runtime.employeeId]);

  if (atlasState.status !== "ready") {
    if (atlasState.status === "loading" && props.suppressLoadingFallback) return null;
    return Fallback ? <Fallback {...fallbackProps} /> : null;
  }

  return <LoadedSpriteBillboard {...props} atlasTexture={atlasState.texture} />;
}

function LoadedSpriteBillboard(
  props: CharacterRendererProps & {
    manifest: SpriteSheetCharacterManifest;
    atlasTexture: THREE.Texture;
  },
) {
  const {
    runtime,
    projection,
    fallback: Fallback,
    manifest,
    atlasTexture,
    ...fallbackProps
  } = props;
  const spriteRef = useRef<THREE.Sprite>(null);
  const elapsedRef = useRef(0);
  const frameRef = useRef(0);
  const activeKeyRef = useRef("");
  const texture = useMemo(() => atlasTexture.clone(), [atlasTexture]);
  const material = useMemo(
    () => new THREE.SpriteMaterial({ map: texture, transparent: true }),
    [texture],
  );
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
      activitySceneAnimation: runtime.activityScene?.baseSpriteAnimation,
    });
    const animation = manifest.animations[key] ?? manifest.animations.idle;
    if (activeKeyRef.current !== key) {
      activeKeyRef.current = key;
      frameRef.current = runtime.reducedMotion
        ? 0
        : getSpriteInitialFrame(runtime.employeeId, key, animation.frames);
      elapsedRef.current = runtime.reducedMotion
        ? 0
        : getSpriteInitialElapsedMs(runtime.employeeId, key, animation.durationsMs);
    }

    if (!runtime.reducedMotion) {
      elapsedRef.current += delta * 1000;
      const currentDuration =
        animation.durationsMs[frameRef.current] ?? animation.durationsMs[0] ?? 140;
      if (elapsedRef.current >= currentDuration) {
        elapsedRef.current = 0;
        frameRef.current = (frameRef.current + 1) % animation.frames;
      }
    }

    texture.offset.set(
      frameRef.current / manifest.grid.columns,
      1 - (animation.row + 1) / manifest.grid.rows,
    );

    if (spriteRef.current) {
      spriteRef.current.position.y = runtime.reducedMotion
        ? 0
        : getSpriteTravelBobbleY(
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
    return Fallback ? (
      <Fallback {...fallbackProps} runtime={runtime} projection={projection} />
    ) : null;
  }

  const indicatorColor = getEmployeeIndicatorColor({
    teamId: props.teamId,
    activityState: runtime.activityState,
  });

  return (
    <group>
      {!projection && (runtime.isHighlighted || runtime.isSelected || runtime.isHovered) ? (
        <>
          <SpriteHighlightHalo
            active={runtime.isHighlighted}
            focused={runtime.isSelected || runtime.isHovered}
            opacity={props.presenceVisual?.bodyOpacity ?? 1}
          />
          <SpriteHighlightFloorRing
            active={runtime.isHighlighted}
            focused={runtime.isSelected || runtime.isHovered}
            opacity={props.presenceVisual?.bodyOpacity ?? 1}
          />
        </>
      ) : null}
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

function SpriteHighlightHalo({
  active,
  focused,
  opacity,
}: {
  active: boolean;
  focused: boolean;
  opacity: number;
}) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = active ? 12 : 8;
    context.strokeStyle = active ? "rgba(56, 189, 248, 1)" : "rgba(255, 255, 255, 0.78)";
    context.shadowBlur = active ? 28 : 14;
    context.shadowColor = active ? "rgba(56, 189, 248, 0.95)" : "rgba(255, 255, 255, 0.58)";
    context.beginPath();
    context.ellipse(64, 68, active ? 48 : 42, active ? 54 : 48, 0, 0, Math.PI * 2);
    context.stroke();
    if (active) {
      context.lineWidth = 3;
      context.strokeStyle = "rgba(255, 255, 255, 0.92)";
      context.shadowBlur = 0;
      context.beginPath();
      context.ellipse(64, 68, 34, 40, 0, 0, Math.PI * 2);
      context.stroke();
    }
    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.minFilter = THREE.LinearFilter;
    return nextTexture;
  }, [active]);
  const material = useMemo(
    () =>
      texture
        ? new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            opacity: opacity * (active ? 0.95 : focused ? 0.72 : 0),
          })
        : null,
    [active, focused, opacity, texture],
  );

  useEffect(() => {
    return () => {
      texture?.dispose();
      material?.dispose();
    };
  }, [material, texture]);

  if (!material) return null;

  return (
    <sprite
      material={material}
      position={[0, TOTAL_HEIGHT * 0.02, -0.04]}
      scale={[TOTAL_HEIGHT * 1.02, TOTAL_HEIGHT * 1.28, 1]}
    />
  );
}

function SpriteHighlightFloorRing({
  active,
  focused,
  opacity,
}: {
  active: boolean;
  focused: boolean;
  opacity: number;
}) {
  const ringOpacity = opacity * (active ? 0.9 : focused ? 0.58 : 0);
  return (
    <mesh
      position={[0, -TOTAL_HEIGHT * 0.48, 0.02]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={9}
    >
      <ringGeometry args={[0.34, 0.52, 48]} />
      <meshBasicMaterial
        color={active ? "#38bdf8" : "#ffffff"}
        transparent
        opacity={ringOpacity}
        depthTest={false}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
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
