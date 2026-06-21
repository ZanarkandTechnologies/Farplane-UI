/**
 * Shared office object footprint rules.
 *
 * The CLI placement tests and the browser occupancy system both consume this
 * dependency-free module so their collision math cannot drift.
 */

export interface ObjectFootprint {
  width: number;
  depth: number;
  clearance: number;
}

export const DEFAULT_OBJECT_FOOTPRINT: ObjectFootprint = {
  width: 2,
  depth: 2,
  clearance: 0.25,
};

export const OBJECT_FOOTPRINT_BY_MESH_TYPE: Record<string, ObjectFootprint> = {
  "team-cluster": { width: 9.2, depth: 7.4, clearance: 0.5 },
  plant: { width: 1, depth: 1, clearance: 0.2 },
  couch: { width: 3.4, depth: 2.2, clearance: 0.8 },
  bookshelf: { width: 3.1, depth: 1.4, clearance: 0.65 },
  pantry: { width: 7.2, depth: 2.4, clearance: 0.65 },
  "glass-wall": { width: 4, depth: 0.35, clearance: 0.05 },
  "office-divider": { width: 4, depth: 0.32, clearance: 0.05 },
  "custom-mesh": DEFAULT_OBJECT_FOOTPRINT,
};

export function getMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getObjectFootprint(input: {
  meshType: string;
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
}): ObjectFootprint {
  const base = OBJECT_FOOTPRINT_BY_MESH_TYPE[input.meshType] ?? DEFAULT_OBJECT_FOOTPRINT;
  const width = Math.max(0.1, getMetadataNumber(input.metadata, "footprintWidth") ?? base.width);
  const depth = Math.max(0.1, getMetadataNumber(input.metadata, "footprintDepth") ?? base.depth);
  const clearance = Math.max(0, getMetadataNumber(input.metadata, "footprintClearance") ?? base.clearance);
  const rotationY = input.rotation?.[1] ?? 0;
  if (!Number.isFinite(rotationY)) return { width, depth, clearance };

  const cos = Math.abs(Math.cos(rotationY));
  const sin = Math.abs(Math.sin(rotationY));
  return {
    width: width * cos + depth * sin,
    depth: width * sin + depth * cos,
    clearance,
  };
}
