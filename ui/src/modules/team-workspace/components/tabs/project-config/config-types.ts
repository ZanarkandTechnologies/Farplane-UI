export type FarplaneConfigSection = {
  level: number;
  title: string;
  body: string;
};

export type FarplaneConfigFile = {
  id: string;
  path: string;
  absolutePath: string;
  title: string;
  kind: string;
  format: "json" | "markdown";
  exists: boolean;
  content: string;
  updatedAtMs: number | null;
  frontMatter: Record<string, string>;
  sections: FarplaneConfigSection[];
  parsedJson: unknown;
  error?: string;
};

export type FarplaneRuntimeSource = {
  id: string;
  label: string;
  path: string;
  kind: "file" | "directory";
  absolutePath: string;
  exists: boolean;
  updatedAtMs: number | null;
  childCount: number | null;
};

export type FarplaneProjectConfig = {
  ok: boolean;
  projectPath: string;
  generatedAtMs: number;
  files: FarplaneConfigFile[];
  runtimeSources: FarplaneRuntimeSource[];
};

export type ProjectConfigLoadState = "idle" | "loading" | "ready" | "error";
