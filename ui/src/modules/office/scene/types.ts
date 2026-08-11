/**
 * OFFICE SCENE TYPES
 * ==================
 * Shared types for the office scene composition modules.
 *
 * KEY CONCEPTS:
 * - Keep the public scene props stable while internal modules split by responsibility.
 * - Scene internals should import shared contracts from here instead of redefining them.
 *
 * USAGE:
 * - Import `OfficeSceneProps` from the public scene shell and internal scene modules.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

import type { OfficeAreaNode } from "@/modules/office/lib/office-area-layout";
import type { OfficeFootprint } from "@/modules/office/lib/office-footprint";
import type { OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import type {
  DeskLayoutData,
  EmployeeData,
  OfficeId,
  OfficeObject,
  TeamData,
} from "@/modules/office/lib/types";
import type { OfficeSettingsModel } from "@/modules/runtime";
import type { CompanyWorldProjection } from "@/modules/world-map/types";

export interface OfficeSceneProps {
  teams: TeamData[];
  employees: EmployeeData[];
  desks: DeskLayoutData[];
  officeObjects: OfficeObject[];
  officeAreas: OfficeAreaNode[];
  officeFootprint: OfficeFootprint;
  officeLayout: OfficeLayoutModel;
  officeLayoutStrategy?: OfficeSettingsModel["layoutStrategy"];
  worldNexusProjection?: CompanyWorldProjection;
  officeDecorSettings: OfficeSettingsModel["decor"];
  officeViewSettings: Pick<
    OfficeSettingsModel,
    "viewProfile" | "orbitControlsEnabled" | "cameraOrientation"
  >;
  companyId?: OfficeId<"companies">;
  customMeshLoadSignature?: string;
  onNavigationReady?: () => void;
  onNavigationReset?: () => void;
}
