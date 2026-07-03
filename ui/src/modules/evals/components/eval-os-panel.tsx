"use client";

/**
 * Eval OS panel
 * Inputs: local eval run artifacts from the Vite bridge plus optional manual JSON report files.
 * Outputs: read-only dashboard, run history, filtered task grid, and task-level evidence view.
 * Side effects: browser fetches only; no eval artifact mutation.
 */

import { FileJson2, RefreshCw, Upload } from "lucide-react";
import {
  type ChangeEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EvalRunHistory } from "@/modules/evals/components/eval-run-history";
import { EvalTaskDetailPanel } from "@/modules/evals/components/eval-task-detail";
import { EvalTaskGrid } from "@/modules/evals/components/eval-task-grid";
import {
  AGGREGATE_RUN_ID,
  buildAggregateSummary,
  computeAggregateMetrics,
  formatScorePercent,
  getSkillCatalogIds,
  type SkillCatalogResponse,
} from "@/modules/evals/lib/eval-aggregate";
import {
  filterEvalTasks,
  formatPercent,
  formatRunDate,
  isEvalSummary,
  isEvalTaskDetail,
  sortRunIndex,
} from "@/modules/evals/lib/eval-artifacts";
import { computeEvalHealth } from "@/modules/evals/lib/eval-health";
import type {
  EvalRunIndexEntry,
  EvalRunResponse,
  EvalRunsResponse,
  EvalSummary,
  EvalTaskDetail,
  EvalTaskFilter,
  EvalTaskScopeFilter,
} from "@/modules/evals/lib/eval-types";

type SkillEvalRunRow = {
  jobId: string;
};

type SkillEvalRunsResponse = {
  ok: boolean;
  rows?: SkillEvalRunRow[];
  error?: string;
};

type EvalMode = "aggregate" | "run";
type SingleRunTab = "tasks" | "failures" | "artifacts";

async function readJsonFileInput(file: File): Promise<unknown> {
  return JSON.parse(await file.text()) as unknown;
}

function upsertManualRun(runs: EvalRunIndexEntry[], summary: EvalSummary): EvalRunIndexEntry[] {
  const entry: EvalRunIndexEntry = {
    job_id: summary.job_id,
    label: summary.label ?? "manual report",
    created_at: summary.created_at,
    completed_at: summary.completed_at,
    task_count: summary.task_count ?? summary.tasks.length,
    pass_rate: summary.pass_rate,
  };
  return sortRunIndex([entry, ...runs.filter((run) => run.job_id !== summary.job_id)]);
}

function CompactEvalMetric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string | number;
}): ReactElement {
  return (
    <div className="grid w-[140px] shrink-0 grid-rows-2 gap-0.5 border-r px-3 py-1.5 text-xs last:border-r-0">
      <div className="truncate text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="shrink-0 text-sm font-semibold leading-none tabular-nums">{value}</span>
        <span className="truncate text-[10px] leading-none text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
}

export function EvalOsPanel(): ReactElement {
  const [searchParams] = useSearchParams();
  const skillQuery = searchParams.get("skill") ?? "";
  const requestedRunId = searchParams.get("run");
  const [runs, setRuns] = useState<EvalRunIndexEntry[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [summary, setSummary] = useState<EvalSummary | null>(null);
  const [detailsByTaskId, setDetailsByTaskId] = useState<Record<string, EvalTaskDetail>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [query, setQuery] = useState(skillQuery);
  const [filter, setFilter] = useState<EvalTaskFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<EvalTaskScopeFilter>("all");
  const [mode, setMode] = useState<EvalMode>(requestedRunId ? "run" : "aggregate");
  const [singleRunTab, setSingleRunTab] = useState<SingleRunTab>("tasks");
  const [skillCatalogIds, setSkillCatalogIds] = useState<string[]>([]);
  const [status, setStatus] = useState("Loading eval artifacts...");
  const [error, setError] = useState<string | null>(null);
  const summaryInputRef = useRef<HTMLInputElement | null>(null);
  const detailsInputRef = useRef<HTMLInputElement | null>(null);

  const loadAggregateRun = useCallback(async (sourceRuns: EvalRunIndexEntry[]): Promise<void> => {
    setStatus("Loading aggregate...");
    setError(null);
    const newestTaskById = new Map<string, EvalSummary["tasks"][number]>();
    const aggregateDetailsByTaskId: Record<string, EvalTaskDetail> = {};

    for (const run of sourceRuns) {
      const response = await fetch(`/farplane/evals/runs/${encodeURIComponent(run.job_id)}`);
      const payload = (await response.json()) as EvalRunResponse;
      if (!response.ok || !payload.ok || !payload.summary) continue;

      for (const task of payload.summary.tasks) {
        if (newestTaskById.has(task.task_id)) continue;
        newestTaskById.set(task.task_id, {
          ...task,
          reason: task.reason ?? payload.detailsByTaskId?.[task.task_id]?.judge?.reason,
        });
        const detail = payload.detailsByTaskId?.[task.task_id];
        if (detail) aggregateDetailsByTaskId[task.task_id] = detail;
      }
    }

    const aggregateTasks = Array.from(newestTaskById.values());
    setSelectedRunId(AGGREGATE_RUN_ID);
    setSummary(
      buildAggregateSummary({
        detailsByTaskId: aggregateDetailsByTaskId,
        runs: sourceRuns,
        tasks: aggregateTasks,
      }),
    );
    setDetailsByTaskId(aggregateDetailsByTaskId);
    setSelectedTaskId(null);
    setIsDetailOpen(false);
    setStatus(`Loaded latest result for ${aggregateTasks.length} eval task(s).`);
  }, []);

  const loadRun = useCallback(async (runId: string): Promise<void> => {
    setStatus(`Loading ${runId}...`);
    setError(null);
    const response = await fetch(`/farplane/evals/runs/${encodeURIComponent(runId)}`);
    const payload = (await response.json()) as EvalRunResponse;
    if (!response.ok || !payload.ok || !payload.summary) {
      throw new Error(payload.error ?? "eval_run_load_failed");
    }
    setMode("run");
    setSelectedRunId(payload.summary.job_id);
    setSummary(payload.summary);
    setDetailsByTaskId(payload.detailsByTaskId ?? {});
    setSelectedTaskId(null);
    setIsDetailOpen(false);
    setStatus(`Loaded ${payload.summary.job_id}`);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setStatus("Refreshing eval runs...");
    setError(null);
    try {
      const response = await fetch("/farplane/evals/runs");
      const payload = (await response.json()) as EvalRunsResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "eval_runs_load_failed");
      }
      const nextRuns = sortRunIndex(payload.runs ?? []);
      setRuns(nextRuns);
      const matchingSkillRunId = skillQuery
        ? await fetch(`/farplane/evals/skill-runs?skill=${encodeURIComponent(skillQuery)}`)
            .then((skillResponse) => skillResponse.json() as Promise<SkillEvalRunsResponse>)
            .then((skillPayload) => skillPayload.rows?.[0]?.jobId ?? null)
            .catch(() => null)
        : null;
      const requestedRun = requestedRunId
        ? nextRuns.find((run) => run.job_id === requestedRunId)
        : null;
      const runToLoad =
        requestedRunId === AGGREGATE_RUN_ID
          ? AGGREGATE_RUN_ID
          : (requestedRun?.job_id ?? (requestedRunId ? matchingSkillRunId : AGGREGATE_RUN_ID));
      if (runToLoad === AGGREGATE_RUN_ID) {
        setMode("aggregate");
        await loadAggregateRun(nextRuns);
      } else if (runToLoad) {
        setMode("run");
        await loadRun(runToLoad);
      } else {
        setSelectedRunId(null);
        setSummary(null);
        setDetailsByTaskId({});
        setSelectedTaskId(null);
        setIsDetailOpen(false);
        setStatus(
          payload.exists ? "No eval runs indexed yet." : "No .farplane/evals artifacts found.",
        );
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "eval_os_refresh_failed");
      setStatus("Eval artifacts unavailable.");
    }
  }, [loadAggregateRun, loadRun, requestedRunId, skillQuery]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    async function loadSkillCatalog(): Promise<void> {
      try {
        const response = await fetch("/openclaw/skills/catalog");
        if (!response.ok) return;
        const payload = (await response.json()) as SkillCatalogResponse;
        if (!cancelled) setSkillCatalogIds(getSkillCatalogIds(payload.skills ?? []));
      } catch {
        if (!cancelled) setSkillCatalogIds([]);
      }
    }
    void loadSkillCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!skillQuery) return;
    setQuery(skillQuery);
    setMode("aggregate");
  }, [skillQuery]);

  const health = useMemo(
    () => computeEvalHealth(summary, detailsByTaskId),
    [summary, detailsByTaskId],
  );
  const aggregateMetrics = useMemo(
    () => computeAggregateMetrics({ detailsByTaskId, skillCatalogIds, summary }),
    [detailsByTaskId, skillCatalogIds, summary],
  );
  const failingTasks = useMemo(
    () => filterEvalTasks(summary?.tasks ?? [], detailsByTaskId, query, "fail", scopeFilter),
    [detailsByTaskId, query, scopeFilter, summary?.tasks],
  );
  const selectedTask = summary?.tasks.find((task) => task.task_id === selectedTaskId) ?? null;
  const selectedDetail = selectedTask ? detailsByTaskId[selectedTask.task_id] : undefined;
  const verdictEntries = useMemo(() => {
    const counts = summary?.verdict_counts ?? {};
    const keys = Array.from(new Set(["A", "B", "C", "D", ...Object.keys(counts)]));
    const max = Math.max(...keys.map((key) => Number(counts[key] ?? 0)), 1);
    return keys.map((key) => ({
      key,
      count: Number(counts[key] ?? 0),
      percent: (Number(counts[key] ?? 0) / max) * 100,
    }));
  }, [summary?.verdict_counts]);

  const handleSummaryUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const json = await readJsonFileInput(file);
      if (!isEvalSummary(json)) throw new Error("summary_json_invalid");
      setMode("run");
      setSummary(json);
      setSelectedRunId(json.job_id);
      setRuns((current) => upsertManualRun(current, json));
      setSelectedTaskId(null);
      setIsDetailOpen(false);
      setStatus(`Loaded manual summary ${json.job_id}`);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "summary_json_load_failed");
    }
  };

  const handleDetailUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    try {
      const nextDetails: Record<string, EvalTaskDetail> = {};
      for (const file of files) {
        const json = await readJsonFileInput(file);
        if (!isEvalTaskDetail(json)) throw new Error(`${file.name}: detail_json_invalid`);
        const detail = json;
        const taskId = detail.task_id ?? detail.summary?.task_id ?? detail.task?.id;
        if (!taskId) throw new Error(`${file.name}: task_id_missing`);
        nextDetails[taskId] = { ...detail, task_id: taskId };
      }
      setDetailsByTaskId((current) => ({ ...current, ...nextDetails }));
      setStatus(`Loaded ${Object.keys(nextDetails).length} task detail file(s)`);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "detail_json_load_failed");
    }
  };

  const openTaskDetail = (taskId: string): void => {
    setSelectedTaskId(taskId);
    setIsDetailOpen(true);
  };

  return (
    <div
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3"
      data-testid="eval-os-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="flex rounded-md border bg-muted/20 p-0.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "aggregate" ? "secondary" : "ghost"}
              onClick={() => {
                setMode("aggregate");
                void loadAggregateRun(runs).catch((nextError) => {
                  setError(
                    nextError instanceof Error ? nextError.message : "eval_aggregate_load_failed",
                  );
                });
              }}
              disabled={!runs.length}
            >
              All / Latest
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "run" ? "secondary" : "ghost"}
              onClick={() => {
                setMode("run");
                if (selectedRunId === AGGREGATE_RUN_ID && runs[0]?.job_id) {
                  void loadRun(runs[0].job_id).catch((nextError) => {
                    setError(
                      nextError instanceof Error ? nextError.message : "eval_run_load_failed",
                    );
                  });
                }
              }}
              disabled={!runs.length}
            >
              Single Run
            </Button>
          </div>
          {mode === "run" ? (
            <Select
              value={selectedRunId === AGGREGATE_RUN_ID ? "" : (selectedRunId ?? "")}
              onValueChange={(runId) =>
                void loadRun(runId).catch((nextError) => {
                  setError(nextError instanceof Error ? nextError.message : "eval_run_load_failed");
                })
              }
              disabled={!runs.length}
            >
              <SelectTrigger size="sm" className="w-[280px] max-w-full">
                <SelectValue placeholder="Select run" />
              </SelectTrigger>
              <SelectContent>
                {runs.map((run) => (
                  <SelectItem key={run.job_id} value={run.job_id}>
                    {run.label || run.job_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <div className="hidden min-w-0 text-xs text-muted-foreground md:block">
            <span>
              {mode === "aggregate" ? "latest per eval" : formatRunDate(summary?.created_at)}
            </span>
            <span className="mx-2">/</span>
            <span>{summary?.harness ?? "harness unknown"}</span>
            <span className="mx-1">/</span>
            <span>{summary?.judge_harness ?? "judge unknown"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{summary?.suite ?? "suite"}</Badge>
          <span className="max-w-[280px] truncate text-xs text-muted-foreground">
            {error ?? status}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => void refresh()}
            aria-label="Refresh eval runs"
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => summaryInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Summary
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => detailsInputRef.current?.click()}
          >
            <FileJson2 className="size-4" />
            Details
          </Button>
        </div>
      </div>

      {summary ? (
        <>
          {mode === "aggregate" ? (
            <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
              <div className="flex min-h-[52px] flex-wrap items-stretch overflow-hidden rounded-md border bg-card/70">
                <CompactEvalMetric
                  label="Harness"
                  value={formatScorePercent(aggregateMetrics.harnessScore ?? Number.NaN)}
                  detail="weighted"
                />
                <CompactEvalMetric
                  label="Quality"
                  value={formatScorePercent(aggregateMetrics.evalQuality ?? Number.NaN)}
                  detail="evaled"
                />
                <CompactEvalMetric
                  label="Coverage"
                  value={aggregateMetrics.coverageLabel}
                  detail={
                    aggregateMetrics.coverageRate === undefined
                      ? "no catalog"
                      : formatScorePercent(aggregateMetrics.coverageRate)
                  }
                />
                <CompactEvalMetric
                  label="Failing"
                  value={aggregateMetrics.failingCount}
                  detail={`${aggregateMetrics.noEvalCount ?? 0} gaps`}
                />
                <HoverCard openDelay={150}>
                  <HoverCardTrigger asChild>
                    <button
                      type="button"
                      className="grid w-[140px] shrink-0 grid-rows-2 gap-0.5 border-r px-3 py-1.5 text-left text-xs hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <span className="truncate text-[10px] uppercase text-muted-foreground">
                        Grade Mix
                      </span>
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="shrink-0 text-sm font-semibold leading-none">
                          {health.verdict}
                        </span>
                        <span className="truncate text-[10px] leading-none text-muted-foreground">
                          details
                        </span>
                      </span>
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent align="start" className="z-[10000] w-80">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Grade Mix</p>
                      <Badge variant={aggregateMetrics.failingCount ? "destructive" : "secondary"}>
                        {health.verdict}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {verdictEntries.map((entry) => (
                        <div
                          key={entry.key}
                          className="grid grid-cols-[28px_minmax(0,1fr)_32px] items-center gap-2 text-xs"
                        >
                          <span className="font-semibold">{entry.key}</span>
                          <Progress value={entry.percent} className="h-1.5 bg-muted" />
                          <span className="text-right text-muted-foreground">{entry.count}</span>
                        </div>
                      ))}
                      {aggregateMetrics.noEvalCount ? (
                        <div className="grid grid-cols-[28px_minmax(0,1fr)_32px] items-center gap-2 text-xs">
                          <span className="font-semibold">--</span>
                          <Progress
                            value={Math.min(100, aggregateMetrics.noEvalCount * 4)}
                            className="h-1.5 bg-muted"
                          />
                          <span className="text-right text-muted-foreground">
                            {aggregateMetrics.noEvalCount}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </HoverCardContent>
                </HoverCard>
                <div className="flex min-w-[220px] flex-1 items-center gap-2 px-3 py-1.5 text-xs">
                  <span className="shrink-0 text-[10px] uppercase text-muted-foreground">Next</span>
                  <span className="min-w-0 truncate">
                    {aggregateMetrics.priorityItems[0] ?? "No priority work"}
                  </span>
                </div>
              </div>
              <EvalTaskGrid
                tasks={summary.tasks}
                detailsByTaskId={detailsByTaskId}
                selectedTaskId={selectedTaskId}
                query={query}
                filter={filter}
                scopeFilter={scopeFilter}
                onQueryChange={setQuery}
                onFilterChange={setFilter}
                onScopeFilterChange={setScopeFilter}
                onSelectTask={openTaskDetail}
              />
            </div>
          ) : (
            <Tabs
              value={singleRunTab}
              onValueChange={(value) => setSingleRunTab(value as SingleRunTab)}
              className="flex min-h-0 flex-col overflow-hidden"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <TabsList className="w-fit max-w-full flex-wrap justify-start">
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="failures">Failures</TabsTrigger>
                  <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={health.failureCount ? "destructive" : "secondary"}>
                    {formatPercent(health.passRate)}
                  </Badge>
                  <span>{health.taskCount} tasks</span>
                  <span>{health.loadedDetailCount} details</span>
                </div>
              </div>

              <TabsContent value="tasks" className="m-0 min-h-0 flex-1">
                <EvalTaskGrid
                  tasks={summary.tasks}
                  detailsByTaskId={detailsByTaskId}
                  selectedTaskId={selectedTaskId}
                  query={query}
                  filter={filter}
                  scopeFilter={scopeFilter}
                  onQueryChange={setQuery}
                  onFilterChange={setFilter}
                  onScopeFilterChange={setScopeFilter}
                  onSelectTask={openTaskDetail}
                />
              </TabsContent>

              <TabsContent value="failures" className="m-0 min-h-0 flex-1">
                <EvalTaskGrid
                  tasks={failingTasks}
                  detailsByTaskId={detailsByTaskId}
                  selectedTaskId={selectedTaskId}
                  query={query}
                  filter="all"
                  scopeFilter={scopeFilter}
                  onQueryChange={setQuery}
                  onFilterChange={setFilter}
                  onScopeFilterChange={setScopeFilter}
                  onSelectTask={openTaskDetail}
                />
              </TabsContent>

              <TabsContent value="artifacts" className="m-0 min-h-0 flex-1">
                <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[22rem_minmax(0,1fr)]">
                  <EvalRunHistory
                    runs={runs}
                    selectedRunId={selectedRunId}
                    onSelectRun={(runId) =>
                      void loadRun(runId).catch((nextError) => {
                        setError(
                          nextError instanceof Error ? nextError.message : "eval_run_load_failed",
                        );
                      })
                    }
                  />
                  <div className="grid min-h-0 gap-3 md:grid-cols-2">
                    <div className="rounded-md border p-4">
                      <p className="text-sm font-semibold">Loaded Artifacts</p>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
                          <span className="text-muted-foreground">summary</span>
                          <span className="truncate font-mono text-xs">{summary.job_id}</span>
                        </div>
                        <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
                          <span className="text-muted-foreground">details</span>
                          <span>{Object.keys(detailsByTaskId).length} loaded</span>
                        </div>
                        <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
                          <span className="text-muted-foreground">suite</span>
                          <span>{summary.suite ?? "--"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-sm font-semibold">Manual Import</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Import updates this panel without mutating eval artifacts.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" onClick={() => summaryInputRef.current?.click()}>
                          <Upload className="size-4" />
                          Summary
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => detailsInputRef.current?.click()}
                        >
                          <FileJson2 className="size-4" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <Sheet open={isDetailOpen && Boolean(selectedTask)} onOpenChange={setIsDetailOpen}>
            <SheetContent className="z-[10000] w-[640px] max-w-[92vw] gap-0 p-0 sm:max-w-[640px]">
              <SheetHeader className="border-b">
                <SheetTitle>Eval Task Detail</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 p-4">
                <EvalTaskDetailPanel task={selectedTask} detail={selectedDetail} />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <div className="grid min-h-0 place-items-center rounded-md border border-dashed bg-muted/10">
          <div className="w-full max-w-2xl space-y-4 p-6 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-md border bg-background">
              <FileJson2 className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">No eval run loaded</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Eval OS reads `.farplane/evals/runs` or a local eval report JSON.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button type="button" onClick={() => summaryInputRef.current?.click()}>
                <Upload className="size-4" />
                Load summary.json
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => detailsInputRef.current?.click()}
              >
                <FileJson2 className="size-4" />
                Load task details
              </Button>
            </div>
          </div>
        </div>
      )}
      <Input
        ref={summaryInputRef}
        id="eval-summary-file"
        className="hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => void handleSummaryUpload(event)}
      />
      <Input
        ref={detailsInputRef}
        id="eval-detail-files"
        className="hidden"
        type="file"
        accept="application/json,.json"
        multiple
        onChange={(event) => void handleDetailUpload(event)}
      />
    </div>
  );
}
