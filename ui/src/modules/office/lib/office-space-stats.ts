/**
 * OFFICE SPACE STATS
 * ==================
 * Pure HUD metrics for compactness and agent presence counts.
 *
 * Inputs are derived scene objects, employees, and the active layout tile mask.
 * Outputs are display-ready ratios/counts with no React or renderer dependency.
 */

import {
  getOfficeLayoutBounds,
  getOfficeLayoutTileSet,
  type OfficeLayoutModel,
} from "@/modules/office/lib/office-layout";
import { evaluateOfficeLayoutQuality } from "@/modules/office/lib/office-layout-quality";
import type { EmployeeData, OfficeObject } from "@/modules/office/lib/types";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";

export interface OfficeSpaceStats {
  totalEmployees: number;
  persistentEmployees: number;
  ephemeralEmployees: number;
  otherEmployees: number;
  floorTiles: number;
  occupiedTiles: number;
  emptyTiles: number;
  emptyPercent: number;
  maskFillPercent: number;
  walkablePercent: number;
  disconnectedWalkableTiles: number;
  deadEndCount: number;
  chokePointCount: number;
  disconnectedTargetCount: number;
  averageImportantPathLength: number | null;
  layoutQualityScore: number;
}

export function deriveOfficeSpaceStats(input: {
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
  officeLayout: OfficeLayoutModel;
}): OfficeSpaceStats {
  const layoutTiles = getOfficeLayoutTileSet(input.officeLayout);
  const occupiedTiles = new Set<string>();
  for (const object of input.officeObjects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells(object)) {
      if (layoutTiles.has(cell.key)) occupiedTiles.add(cell.key);
    }
  }

  const floorTiles = layoutTiles.size;
  const occupiedTileCount = occupiedTiles.size;
  const emptyTiles = Math.max(0, floorTiles - occupiedTileCount);
  const persistentEmployees = input.employees.filter(
    (employee) => employee.presencePersistent === true,
  ).length;
  const ephemeralEmployees = input.employees.filter(
    (employee) => employee.presencePersistent === false,
  ).length;
  const bounds = getOfficeLayoutBounds(input.officeLayout);
  const boundingTiles = Math.max(1, bounds.width * bounds.depth);
  const quality = evaluateOfficeLayoutQuality({
    layout: input.officeLayout,
    objects: input.officeObjects,
  });

  return {
    totalEmployees: input.employees.length,
    persistentEmployees,
    ephemeralEmployees,
    otherEmployees: Math.max(0, input.employees.length - persistentEmployees - ephemeralEmployees),
    floorTiles,
    occupiedTiles: occupiedTileCount,
    emptyTiles,
    emptyPercent: floorTiles > 0 ? emptyTiles / floorTiles : 0,
    maskFillPercent: floorTiles / boundingTiles,
    walkablePercent: quality.reachablePercent,
    disconnectedWalkableTiles: quality.disconnectedWalkableTiles,
    deadEndCount: quality.deadEndCount,
    chokePointCount: quality.chokePointCount,
    disconnectedTargetCount: quality.disconnectedTargetCount,
    averageImportantPathLength: quality.averageImportantPathLength,
    layoutQualityScore: quality.score,
  };
}
