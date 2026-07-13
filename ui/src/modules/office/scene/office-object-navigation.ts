/**
 * OFFICE OBJECT NAVIGATION
 * ========================
 * Pure helpers for deciding which rendered office objects become pathfinding obstacles.
 *
 * KEY CONCEPTS:
 * - Navigation readiness must count only objects that the renderer will actually mount
 *   with a registered obstacle ref.
 * - The obstacle signature includes render-affecting geometry inputs, not only object ids.
 */

import type {
  DeskLayoutData,
  OfficeObject,
  TeamData,
} from "@/modules/office/lib/types";
import { shouldUseRoundTeamTable } from "@/modules/office/utils/layout";

const NAVIGABLE_RENDERED_MESH_TYPES = new Set([
  "plant",
  "couch",
  "bookshelf",
  "pantry",
  "activity-landmark",
  "team-cluster",
  "glass-wall",
  "office-divider",
  "custom-mesh",
]);

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function metadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

export function isNavigableRenderableOfficeObject(input: {
  object: OfficeObject;
  teamById: Map<string, TeamData>;
}): boolean {
  const { object, teamById } = input;
  if (!NAVIGABLE_RENDERED_MESH_TYPES.has(object.meshType)) return false;
  if (object.meshType !== "team-cluster") return true;
  const teamId = metadataString(object.metadata, "teamId");
  return teamById.has(teamId);
}

export function getNavigableOfficeObjects(input: {
  officeObjects: OfficeObject[];
  teamById: Map<string, TeamData>;
  enabled: boolean;
}): OfficeObject[] {
  if (!input.enabled) return [];
  return input.officeObjects.filter((object) =>
    isNavigableRenderableOfficeObject({ object, teamById: input.teamById }),
  );
}

export function buildNavigableOfficeObjectSignature(input: {
  officeObjects: OfficeObject[];
  teamById: Map<string, TeamData>;
  desksByTeamId: Map<string, DeskLayoutData[]>;
  customMeshLoadSignature?: string;
}): string {
  const { teamById, desksByTeamId } = input;
  return input.officeObjects
    .map((object) => {
      const teamId = metadataString(object.metadata, "teamId");
      const team = teamId ? teamById.get(teamId) : undefined;
      const teamDesks = team ? (desksByTeamId.get(team._id) ?? []) : [];
      const stationCount = team
        ? Math.max(teamDesks.length, team.employees.length, 1)
        : "";
      return [
        object._id,
        object.meshType,
        object.position.join(","),
        object.rotation?.join(",") ?? "",
        object.scale?.join(",") ?? "",
        metadataNumber(object.metadata, "footprintWidth"),
        metadataNumber(object.metadata, "footprintDepth"),
        metadataString(object.metadata, "furnitureId"),
        metadataString(object.metadata, "landmarkKind"),
        teamId,
        team ? team.employees.length : "",
        teamDesks.length,
        stationCount,
        typeof stationCount === "number"
          ? shouldUseRoundTeamTable(stationCount)
            ? "round"
            : "grid"
          : "",
        object.meshType === "custom-mesh"
          ? metadataString(object.metadata, "meshPublicPath")
          : "",
        object.meshType === "custom-mesh"
          ? (input.customMeshLoadSignature ?? "")
          : "",
      ].join("|");
    })
    .join("||");
}
