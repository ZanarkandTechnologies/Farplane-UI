/** Contracts shared by the server projection and browser-safe Leverage panel. */

export type LeverageCapital = {
  status: "available" | "missing";
  asOf: string | null;
  balanceCents: number | null;
  currency: string | null;
  observedAt: string | null;
  source: string | null;
};

export type LeverageDistributionMetric = {
  metricId: string;
  label: string;
  observedAt: string | null;
  status: string;
  unit: string;
  value: number | null;
};

export type LeverageEdge = {
  projectId: string;
  projectName: string;
  projectRoot: string;
  metricId: string | null;
  label: string;
  observedAt: string | null;
  status: string;
  value: string | null;
};

export type LeverageDistributionAccount = {
  id: string;
  label: string;
  projects: Array<{ id: string; name: string }>;
  metrics: LeverageDistributionMetric[];
};

export type LeverageSourceGap = {
  code: string;
  message: string;
  projectId: string | null;
  projectName: string | null;
  projectRoot: string | null;
  scope: "capital" | "project" | "distribution" | "edge";
};

export type LeverageStrength = {
  kind: "capital" | "distribution" | "edge";
  label: string;
  projectId: string | null;
  projectName: string | null;
  observedAt: string | null;
};

export type LeverageProjection = {
  schema: "farplane_leverage_projection";
  generatedAt: string;
  capital: LeverageCapital;
  distribution: LeverageDistributionAccount[];
  edges: LeverageEdge[];
  sourceGaps: LeverageSourceGap[];
  strengths: LeverageStrength[];
  weaknesses: LeverageSourceGap[];
};

export type BuildLeverageProjectionInput = {
  company: unknown;
  financeProjection: unknown;
  generatedAt?: string;
  readProjectSnapshot: (projectRoot: string) => Promise<unknown>;
};

export type ReadLeverageProjectionInput = {
  companyPath: string;
  financeProjection: unknown;
  generatedAt?: string;
  readText?: (filePath: string) => Promise<string>;
};
