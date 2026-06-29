import type { CompanyModel, ProjectModel } from "@/modules/runtime";
import type { PanelTask, TeamMemoryRow } from "../../team-panel-types";

export type IntelligenceTabProps = {
  project: ProjectModel | null;
  companyModel: CompanyModel | null;
  projectTasks: PanelTask[];
  memoryRows: TeamMemoryRow[];
  globalMode: boolean;
};

export type MetricCard = {
  label: string;
  value: string;
  detail: string;
};

export type SkillCatalogRow = {
  skillId: string;
  displayName?: string;
  description?: string;
  category?: string;
  sourcePath?: string;
  hasManifest?: boolean;
  hasTests?: boolean;
  hasDiagram?: boolean;
  hasSkillMemory?: boolean;
};
