export type EvalVerdict = "A" | "B" | "C" | "D" | string;

export type EvalTaskSummary = {
  task_id: string;
  title?: string;
  pass?: boolean;
  verdict?: EvalVerdict;
  reason?: string;
  detail_path?: string;
  tags?: string[];
};

export type EvalSummary = {
  job_id: string;
  label?: string;
  created_at?: string;
  completed_at?: string;
  harness?: string;
  judge_harness?: string;
  suite?: string;
  task_files?: string[];
  task_count?: number;
  pass_rate?: number;
  verdict_counts?: Record<string, number>;
  tasks: EvalTaskSummary[];
};

export type EvalTask = {
  context?: string;
  id?: string;
  notes?: string;
  title?: string;
  prompt?: string;
  query?: string;
  reference_points?: unknown[];
  input?: unknown;
  expected?: unknown;
  rubric?: string;
  tags?: string[];
  hardcase?: boolean;
};

export type EvalReferencePointResult = {
  id?: string;
  label?: string;
  status?: "pass" | "fail" | "unknown" | string;
  reason?: string;
};

export type EvalJudge = {
  pass?: boolean;
  verdict?: EvalVerdict;
  score?: number;
  reason?: string;
  notes?: string;
  reference_points?: EvalReferencePointResult[];
  reference_point_results?: EvalReferencePointResult[];
};

export type EvalAgent = {
  answer?: string;
  answer_text?: string;
  output?: string;
  transcript_path?: string;
};

export type EvalTaskDetail = {
  task_id?: string;
  title?: string;
  task?: EvalTask;
  agent?: EvalAgent;
  judge?: EvalJudge;
  summary?: EvalTaskSummary;
  artifacts?: Record<string, string>;
  raw?: unknown;
};

export type EvalRunIndexEntry = {
  job_id: string;
  label?: string;
  created_at?: string;
  completed_at?: string;
  summary_path?: string;
  task_count?: number;
  pass_rate?: number;
  verdict?: string;
};

export type EvalRunsResponse = {
  ok: boolean;
  evalsRoot?: string;
  exists?: boolean;
  runs: EvalRunIndexEntry[];
  latest: EvalRunIndexEntry | null;
  error?: string;
};

export type EvalRunResponse = {
  ok: boolean;
  evalsRoot?: string;
  empty?: boolean;
  summary: EvalSummary | null;
  detailsByTaskId: Record<string, EvalTaskDetail>;
  error?: string;
};

export type EvalTaskFilter = "all" | "pass" | "fail" | "A" | "B" | "C" | "D" | "hardcase";

export type EvalTaskScopeFilter = "all" | "skill" | "task" | "agent-md";
