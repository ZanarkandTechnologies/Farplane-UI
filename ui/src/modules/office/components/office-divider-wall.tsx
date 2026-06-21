import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";

interface OfficeDividerWallProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

function getMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default function OfficeDividerWall({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  metadata,
}: OfficeDividerWallProps) {
  const width = getMetadataNumber(metadata, "footprintWidth", 4);
  const height = getMetadataNumber(metadata, "dividerHeight", 2.4);
  const depth = getMetadataNumber(metadata, "footprintDepth", 0.32);
  const wallColor = getMetadataString(metadata, "wallColor", "#ede5d6");
  const capColor = getMetadataString(metadata, "capColor", wallColor);

  return (
    <InteractiveObject
      objectType="office-divider"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
      supportsScaling={false}
    >
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.82} metalness={0.02} />
      </mesh>
      <mesh position={[0, height + 0.035, 0]} receiveShadow>
        <boxGeometry args={[width + 0.08, 0.07, depth + 0.08]} />
        <meshStandardMaterial color={capColor} roughness={0.88} />
      </mesh>
    </InteractiveObject>
  );
}
