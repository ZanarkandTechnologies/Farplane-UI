"use client";

/**
 * Eval OS panel
 * Inputs: local eval run artifacts from the Vite bridge plus optional manual JSON report files.
 * Outputs: read-only dashboard, run history, filtered task grid, and task-level evidence view.
 * Side effects: browser fetches only; no eval artifact mutation.
 */

import { FileJson2, RefreshCw, Upload } from "lucide-react";
import { type ChangeEvent, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { EvalTaskDetailPanel } from "@/modules/evals/components/eval-task-detail";
import { EvalTaskGrid } from "@/modules/evals/components/eval-task-grid";
import {
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

export function EvalOsPanel(): ReactElement {
  const [runs, setRuns] = useState<EvalRunIndexEntry[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [summary, setSummary] = useState<EvalSummary | null>(null);
  const [detailsByTaskId, setDetailsByTaskId] = useState<Record<string, EvalTaskDetail>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EvalTaskFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<EvalTaskScopeFilter>("all");
  const [status, setStatus] = useState("Loading eval artifacts...");
  const [error, setError] = useState<string | null>(null);
  const summaryInputRef = useRef<HTMLInputElement | null>(null);
  const detailsInputRef = useRef<HTMLInputElement | null>(null);

  const loadRun = useCallback(async (runId: string): Promise<void> => {
    setStatus(`Loading ${runId}...`);
    setError(null);
    const response = await fetch(`/farplane/evals/runs/${encodeURIComponent(runId)}`);
    const payload = (await response.json()) as EvalRunResponse;
    if (!response.ok || !payload.ok || !payload.summary) {
      throw new Error(payload.error ?? "eval_run_load_failed");
    }
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
      if (payload.latest?.job_id) {
        await loadRun(payload.latest.job_id);
      } else {
        setSelectedRunId(null);
        setSummary(null);
        setDetailsByTaskId({});
        setSelectedTaskId(null);
        setIsDetailOpen(false);
        setStatus(payload.exists ? "No eval runs indexed yet." : "No .farplane/evals artifacts found.");
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "eval_os_refresh_failed");
      setStatus("Eval artifacts unavailable.");
    }
  }, [loadRun]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const health = useMemo(() => computeEvalHealth(summary, detailsByTaskId), [summary, detailsByTaskId]);
  const selectedTask =
    summary?.tasks.find((task) => task.task_id === selectedTaskId) ?? null;
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
      className="grid h-full min-h-0 grid-rows-[auto_176px_minmax(0,1fr)] gap-3"
      data-testid="eval-os-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="text-[11px] uppercase text-muted-foreground">Run</span>
          <Select
            value={selectedRunId ?? ""}
            onValueChange={(runId) =>
              void loadRun(runId).catch((nextError) => {
                setError(nextError instanceof Error ? nextError.message : "eval_run_load_failed");
              })
            }
            disabled={!runs.length}
          >
            <SelectTrigger size="sm" className="w-[280px] max-w-full">
              <SelectValue placeholder="No run loaded" />
            </SelectTrigger>
            <SelectContent>
              {runs.map((run) => (
                <SelectItem key={run.job_id} value={run.job_id}>
                  {run.label || run.job_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="hidden min-w-0 text-xs text-muted-foreground md:block">
            <span>{formatRunDate(summary?.created_at)}</span>
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
          <Button type="button" size="icon-sm" variant="outline" onClick={() => void refresh()} aria-label="Refresh eval runs">
            <RefreshCw className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => summaryInputRef.current?.click()}>
            <Upload className="size-4" />
            Summary
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => detailsInputRef.current?.click()}>
            <FileJson2 className="size-4" />
            Details
          </Button>
        </div>
      </div>

      {summary ? (
        <>
          <div className="grid min-h-0 grid-cols-[220px_minmax(0,1fr)_190px] gap-3 rounded-md border p-3">
            <div className="grid place-items-center rounded-md border bg-muted/10">
              <div className="text-center">
                <p className="text-5xl font-semibold leading-none">{health.score}</p>
                <p className="mt-1 text-[11px] uppercase text-muted-foreground">health</p>
                <Badge className="mt-3" variant={health.failureCount ? "destructive" : "secondary"}>
                  {health.verdict}
                </Badge>
              </div>
            </div>
            <div className="min-w-0 space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Verdict Mix</p>
                  <p className="text-xs text-muted-foreground">
                    {health.taskCount} tasks / {health.loadedDetailCount} details loaded
                  </p>
                </div>
                <Badge variant={health.failureCount ? "destructive" : "secondary"}>
                  {health.failureCount} failure{health.failureCount === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="space-y-2">
                {verdictEntries.map((entry) => (
                  <div key={entry.key} className="grid grid-cols-[28px_minmax(0,1fr)_32px] items-center gap-2 text-xs">
                    <span className="font-semibold">{entry.key}</span>
                    <Progress value={entry.percent} className="h-1.5 bg-muted" />
                    <span className="text-right text-muted-foreground">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Pass rate</p>
                <p className="mt-2 text-2xl font-semibold">{formatPercent(health.passRate)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Runs</p>
                <p className="mt-2 text-2xl font-semibold">{runs.length}</p>
              </div>
              <div className="col-span-2 min-w-0 rounded-md border p-3">
                <p className="text-muted-foreground">Run artifact</p>
                <p className="mt-2 truncate font-mono text-xs">{summary.job_id}</p>
              </div>
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
              <Button type="button" variant="outline" onClick={() => detailsInputRef.current?.click()}>
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
