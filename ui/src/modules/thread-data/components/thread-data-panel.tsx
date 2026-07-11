"use client";

/**
 * Thread Data mining cockpit
 * Inputs: local Codex thread summaries plus .farplane/mine program and run artifacts.
 * Outputs: run-first mining cockpit, source setup drawer, artifact inspection, and output review.
 * Side effects: writes mining artifacts and verdicts through the Vite state bridge.
 */

import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  Database,
  FileText,
  FolderOpen,
  GitFork,
  ListChecks,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UI_Z } from "@/lib/z-index";
import type {
  GraphWorkbenchEdge,
  GraphWorkbenchKind,
  GraphWorkbenchNode,
} from "@/modules/graph-workbench";
import { GraphWorkbench } from "@/modules/graph-workbench";
import type { MiningEvidenceRow } from "@/modules/thread-data/lib/mining-artifacts";
import {
  artifactGroup,
  artifactPreviewText,
  artifactTone,
  defaultOutputViewMode,
  filterOutputs,
  filterThreads,
  formatMiningDate,
  outputEvidenceRows,
  parseArtifactJson,
  preferredArtifactId,
  runStatusTone,
  scorecardSummary,
  shortJsonValue,
  sortMiningRuns,
} from "@/modules/thread-data/lib/mining-artifacts";
import type {
  ThreadDataArtifact,
  ThreadDataProgram,
  ThreadDataProgramsResponse,
  ThreadDataRunDetail,
  ThreadDataRunIndexEntry,
  ThreadDataRunOutput,
  ThreadDataRunResponse,
  ThreadDataRunsResponse,
  ThreadDataSource,
  ThreadDataThreadsResponse,
} from "@/modules/thread-data/types";

const DEFAULT_THREAD_LIMIT = 80;

interface ThreadDataPanelProps {
  initialRunId?: string | null;
  initialOutputId?: string | null;
  projectPath?: string | null;
}

type ThreadDataDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ProgramDraft = {
  id: string;
  name: string;
  version: string;
  objective: string;
  prompt: string;
};

type OutputViewMode = "summary" | "markdown" | "decisions" | "evidence" | "json" | "redaction";
type ThreadDataTab = "review" | "artifacts" | "attempts" | "programs" | "sources" | "forking";

function scorecardPayload(output: ThreadDataRunOutput | null): unknown {
  if (output?.outputScorecard) return output.outputScorecard;
  const outputJson = output?.outputJson;
  if (outputJson && typeof outputJson === "object" && !Array.isArray(outputJson)) {
    return (outputJson as Record<string, unknown>).scorecard ?? outputJson;
  }
  return outputJson;
}

function draftFromProgram(program: ThreadDataProgram | null): ProgramDraft {
  return {
    id: program?.id ?? "",
    name: program?.name ?? "",
    version: program?.version ?? "",
    objective: program?.objective ?? "",
    prompt: program?.prompt ?? "",
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string; ok?: boolean };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? `request_failed:${response.status}`);
  }
  return payload;
}

export function ThreadDataPanel({
  initialRunId = null,
  initialOutputId = null,
  projectPath = null,
}: ThreadDataPanelProps): ReactElement {
  const [programs, setPrograms] = useState<ThreadDataProgram[]>([]);
  const [threads, setThreads] = useState<ThreadDataSource[]>([]);
  const [runs, setRuns] = useState<ThreadDataRunIndexEntry[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedThreadSet, setSelectedThreadSet] = useState<Set<string>>(new Set());
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<ThreadDataRunDetail | null>(null);
  const [threadQuery, setThreadQuery] = useState("");
  const [runQuery, setRunQuery] = useState("");
  const [outputQuery, setOutputQuery] = useState("");
  const [lastDays, setLastDays] = useState("30");
  const [sourceLimit, setSourceLimit] = useState("20");
  const [status, setStatus] = useState("Loading mining runs...");
  const [error, setError] = useState<string | null>(null);
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(draftFromProgram(null));
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState("report");
  const [threadDataTab, setThreadDataTab] = useState<ThreadDataTab>("review");
  const [outputViewMode, setOutputViewMode] = useState<OutputViewMode>("summary");
  const selectedOutputIdRef = useRef<string | null>(null);
  const selectedProgramIdRef = useRef("");
  const selectedRunIdRef = useRef<string | null>(null);

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );

  const selectedOutput = useMemo(
    () => runDetail?.outputs.find((output) => output.id === selectedOutputId) ?? null,
    [runDetail?.outputs, selectedOutputId],
  );

  const visibleThreads = useMemo(() => filterThreads(threads, threadQuery), [threads, threadQuery]);

  const visibleRuns = useMemo(() => {
    const query = runQuery.trim().toLowerCase();
    if (!query) return runs;
    return runs.filter((run) =>
      [run.runId, run.label, run.programId, run.miningMode, run.source, run.status, run.createdAt]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [runQuery, runs]);

  const visibleOutputs = useMemo(
    () => filterOutputs(runDetail?.outputs ?? [], outputQuery),
    [outputQuery, runDetail?.outputs],
  );

  const selectedArtifact = useMemo(
    () =>
      runDetail?.artifacts?.find((artifact) => artifact.id === selectedArtifactId) ??
      runDetail?.artifacts?.[0] ??
      null,
    [runDetail?.artifacts, selectedArtifactId],
  );

  const selectedOutputJsonText = useMemo(() => {
    if (!selectedOutput?.outputJson) return "No JSON output selected.";
    return JSON.stringify(selectedOutput.outputJson, null, 2);
  }, [selectedOutput?.outputJson]);

  const selectedOutputDecisionsText = useMemo(() => {
    if (selectedOutput?.outputDecisions)
      return JSON.stringify(selectedOutput.outputDecisions, null, 2);
    const outputJson =
      selectedOutput?.outputJson && typeof selectedOutput.outputJson === "object"
        ? (selectedOutput.outputJson as Record<string, unknown>)
        : {};
    return JSON.stringify(outputJson.decisions ?? [], null, 2);
  }, [selectedOutput?.outputDecisions, selectedOutput?.outputJson]);

  const selectedOutputEvidenceRows = useMemo(
    () => outputEvidenceRows(selectedOutput?.outputJson),
    [selectedOutput?.outputJson],
  );

  const selectedScorecard = useMemo(
    () => scorecardSummary(scorecardPayload(selectedOutput)),
    [selectedOutput],
  );

  const mineUrl = useCallback(
    (pathname: string, params: Record<string, number | string | undefined> = {}): string => {
      const searchParams = new URLSearchParams();
      const scopedProjectPath = projectPath?.trim();
      if (scopedProjectPath) searchParams.set("projectPath", scopedProjectPath);
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) searchParams.set(key, String(value));
      }
      const suffix = searchParams.toString();
      return `${pathname}${suffix ? `?${suffix}` : ""}`;
    },
    [projectPath],
  );

  const runProgress = useMemo(() => {
    if (!runDetail?.run.sourceCount) return 0;
    return Math.round((runDetail.run.outputCount / runDetail.run.sourceCount) * 100);
  }, [runDetail?.run.outputCount, runDetail?.run.sourceCount]);

  const loadRun = useCallback(
    async (runId: string, outputId?: string | null): Promise<void> => {
      const payload = await fetchJson<ThreadDataRunResponse>(
        mineUrl(`/farplane/mine/runs/${encodeURIComponent(runId)}`),
      );
      const nextOutputId = outputId ?? null;
      setSelectedRunId(runId);
      selectedRunIdRef.current = runId;
      setRunDetail(payload.detail);
      setSelectedOutputId(nextOutputId);
      selectedOutputIdRef.current = nextOutputId;
      if (nextOutputId) {
        const output = payload.detail?.outputs.find((row) => row.id === nextOutputId) ?? null;
        setThreadDataTab("review");
        setOutputViewMode(defaultOutputViewMode(payload.detail?.run, output));
      }
      setSelectedArtifactId(preferredArtifactId(payload.detail?.artifacts));
      setStatus(`Loaded run ${runId}`);
    },
    [mineUrl],
  );

  const refresh = useCallback(async (): Promise<void> => {
    setError(null);
    setStatus("Refreshing mining runs...");
    try {
      const [programPayload, threadPayload, runPayload] = await Promise.all([
        fetchJson<ThreadDataProgramsResponse>(mineUrl("/farplane/mine/programs")),
        fetchJson<ThreadDataThreadsResponse>(
          mineUrl("/farplane/mine/threads", { limit: DEFAULT_THREAD_LIMIT }),
        ),
        fetchJson<ThreadDataRunsResponse>(mineUrl("/farplane/mine/runs")),
      ]);
      const nextPrograms = programPayload.programs;
      const nextRuns = sortMiningRuns(runPayload.runs ?? []);
      setPrograms(nextPrograms);
      setThreads(threadPayload.threads ?? []);
      setRuns(nextRuns);
      const nextProgramId = selectedProgramIdRef.current || nextPrograms[0]?.id || "";
      setSelectedProgramId(nextProgramId);
      setProgramDraft(
        draftFromProgram(nextPrograms.find((program) => program.id === nextProgramId) ?? null),
      );
      const runToLoad = selectedRunIdRef.current ?? runPayload.latest?.runId ?? null;
      if (runToLoad) {
        const outputToLoad =
          runToLoad === initialRunId ? initialOutputId : selectedOutputIdRef.current;
        await loadRun(runToLoad, outputToLoad);
      } else {
        setRunDetail(null);
        setStatus("No mining runs yet.");
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "thread_data_refresh_failed");
      setStatus("Mining runs unavailable.");
    }
  }, [initialOutputId, initialRunId, loadRun, mineUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!initialRunId) return;
    void loadRun(initialRunId, initialOutputId);
  }, [initialOutputId, initialRunId, loadRun]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: project scope changes must clear retained run ids.
  useEffect(() => {
    selectedOutputIdRef.current = null;
    selectedRunIdRef.current = null;
  }, [projectPath]);

  useEffect(() => {
    selectedProgramIdRef.current = selectedProgramId;
  }, [selectedProgramId]);

  useEffect(() => {
    setProgramDraft(draftFromProgram(selectedProgram));
  }, [selectedProgram]);

  const toggleThread = (threadId: string): void => {
    setSelectedThreadSet((current) => {
      const next = new Set(current);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const selectVisibleThreads = (): void => {
    setSelectedThreadSet(
      new Set(visibleThreads.slice(0, Number(sourceLimit) || 20).map((thread) => thread.id)),
    );
  };

  const replayRun = async (): Promise<void> => {
    if (!selectedRunId) return;
    if (runDetail && !runDetail.replayable) {
      setError(runDetail.replayBlockReason ?? "mining_run_not_replayable");
      setStatus("Replay unavailable for this historical run.");
      return;
    }
    setStatus(`Replaying ${selectedRunId}...`);
    setError(null);
    try {
      const payload = await fetchJson<ThreadDataRunResponse>(
        mineUrl(`/farplane/mine/runs/${encodeURIComponent(selectedRunId)}/replay`),
        {
          method: "POST",
          headers: { "x-farplane-actor-role": "operator" },
        },
      );
      if (payload.detail) {
        const detail = payload.detail;
        setRunDetail(detail);
        if (
          selectedOutputIdRef.current &&
          !detail.outputs.some((output) => output.id === selectedOutputIdRef.current)
        ) {
          selectedOutputIdRef.current = null;
          setSelectedOutputId(null);
        }
        setRuns((current) =>
          sortMiningRuns([detail.run, ...current.filter((run) => run.runId !== detail.run.runId)]),
        );
        setThreadDataTab("attempts");
        setStatus(`Replayed ${selectedRunId}`);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "mining_replay_failed");
      setStatus("Replay failed.");
    }
  };

  const openOutput = (outputId: string): void => {
    const nextOutput = runDetail?.outputs.find((output) => output.id === outputId) ?? null;
    setSelectedOutputId(outputId);
    selectedOutputIdRef.current = outputId;
    setOutputViewMode(defaultOutputViewMode(runDetail?.run, nextOutput));
    setThreadDataTab("review");
  };

  const setOutputVerdict = async (verdict: ThreadDataRunOutput["verdict"]): Promise<void> => {
    if (!selectedRunId || !selectedOutputId) return;
    setStatus(`Marking ${selectedOutputId} ${verdict}...`);
    setError(null);
    try {
      const payload = await fetchJson<ThreadDataRunResponse>(
        mineUrl(
          `/farplane/mine/runs/${encodeURIComponent(selectedRunId)}/outputs/${encodeURIComponent(selectedOutputId)}/verdict`,
        ),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-farplane-actor-role": "operator",
          },
          body: JSON.stringify({ verdict }),
        },
      );
      if (payload.detail) {
        const detail = payload.detail;
        setRunDetail(detail);
        setRuns((current) =>
          sortMiningRuns([detail.run, ...current.filter((run) => run.runId !== detail.run.runId)]),
        );
        setStatus(`Marked ${selectedOutputId} ${verdict}`);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "mining_verdict_update_failed");
      setStatus("Verdict update failed.");
    }
  };

  const selectRun = (runId: string): void => {
    setThreadDataTab("review");
    selectedOutputIdRef.current = null;
    void loadRun(runId);
  };

  return (
    <div
      className="grid h-full min-w-0 min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden"
      data-testid="thread-data-panel"
    >
      <header className="grid min-w-0 gap-3 rounded-md border bg-background/80 p-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-normal">Thread Data</h1>
            <Badge variant="outline">{programs.length} programs</Badge>
            <Badge variant="outline">{runs.length} runs</Badge>
            <Badge variant="outline">
              {runs.reduce((sum, run) => sum + run.outputCount, 0)} outputs
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{status}</p>
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RunSelectorPopover
            query={runQuery}
            rows={visibleRuns}
            selectedId={selectedRunId}
            totalRuns={runs.length}
            triggerLabel={runDetail?.run.runId ?? "Select run"}
            onQueryChange={setRunQuery}
            onSelect={selectRun}
          />
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => void replayRun()}
            disabled={!selectedRunId || runDetail?.replayable === false}
            title={runDetail?.replayable === false ? runDetail.replayBlockReason : undefined}
          >
            <Play className="size-4" />
            Replay
          </Button>
        </div>
      </header>

      <Tabs
        value={threadDataTab}
        onValueChange={(value) => setThreadDataTab(value as ThreadDataTab)}
        className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden"
      >
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="review">
            <ListChecks className="mr-2 size-4" />
            Review
          </TabsTrigger>
          <TabsTrigger value="artifacts">
            <FolderOpen className="mr-2 size-4" />
            Artifacts
          </TabsTrigger>
          <TabsTrigger value="attempts">
            <Play className="mr-2 size-4" />
            Attempts
          </TabsTrigger>
          <TabsTrigger value="programs">
            <FileText className="mr-2 size-4" />
            Programs
          </TabsTrigger>
          <TabsTrigger value="sources">
            <Database className="mr-2 size-4" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="forking">
            <GitFork className="mr-2 size-4" />
            Forking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="min-h-0">
          <div className="grid h-full min-w-0 min-h-0 gap-3 overflow-hidden">
            {selectedOutput ? (
              <OutputDetailScreen
                mode={outputViewMode}
                output={selectedOutput}
                redactionMarkdown={selectedOutput.redactionMarkdown}
                run={runDetail?.run ?? null}
                scorecard={selectedScorecard}
                selectedOutputDecisionsText={selectedOutputDecisionsText}
                selectedOutputEvidenceRows={selectedOutputEvidenceRows}
                selectedOutputJsonText={selectedOutputJsonText}
                onBack={() => {
                  selectedOutputIdRef.current = null;
                  setSelectedOutputId(null);
                }}
                onModeChange={setOutputViewMode}
                onVerdict={setOutputVerdict}
              />
            ) : runDetail ? (
              <section className="grid min-w-0 min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
                <RunHeader detail={runDetail} progress={runProgress} />
                <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={outputQuery}
                      onChange={(event) => setOutputQuery(event.target.value)}
                      placeholder="Filter outputs, tickets, verdicts"
                    />
                  </div>
                  <OutputTable rows={visibleOutputs} onOpen={openOutput} />
                </div>
              </section>
            ) : (
              <EmptyRunState onCreate={() => void refresh()} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="artifacts" className="min-h-0">
          {runDetail ? (
            <ArtifactInspector
              artifacts={runDetail.artifacts ?? []}
              selectedArtifact={selectedArtifact}
              selectedArtifactId={selectedArtifactId}
              onSelect={setSelectedArtifactId}
            />
          ) : (
            <EmptyRunState onCreate={() => void refresh()} />
          )}
        </TabsContent>

        <TabsContent value="attempts" className="min-h-0">
          {runDetail ? (
            <AttemptTimeline attempts={runDetail.attempts ?? []} />
          ) : (
            <EmptyRunState onCreate={() => void refresh()} />
          )}
        </TabsContent>

        <TabsContent value="programs" className="min-h-0">
          <ProgramEditor
            draft={programDraft}
            programs={programs}
            selectedId={selectedProgramId}
            onSelect={setSelectedProgramId}
          />
        </TabsContent>

        <TabsContent value="sources" className="min-h-0">
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="grid gap-2 md:grid-cols-[1fr_100px_100px_auto_auto]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={threadQuery}
                  onChange={(event) => setThreadQuery(event.target.value)}
                  placeholder="Search threads, tickets, workspaces"
                />
              </div>
              <Input value={lastDays} onChange={(event) => setLastDays(event.target.value)} />
              <Input value={sourceLimit} onChange={(event) => setSourceLimit(event.target.value)} />
              <Button variant="outline" onClick={selectVisibleThreads}>
                Select visible
              </Button>
              <Badge variant="outline">Core-owned sources</Badge>
            </div>
            <SourceTable
              rows={visibleThreads}
              selected={selectedThreadSet}
              onToggle={toggleThread}
            />
          </div>
        </TabsContent>

        <TabsContent value="forking" className="min-h-0">
          <ForkingPanel runDetail={runDetail} threads={threads} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ThreadDataDialog({ open, onOpenChange }: ThreadDataDialogProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[90vh] min-w-[92vw] max-w-none flex-col overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Thread Data</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 p-4">
          <ThreadDataPanel />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RunSelectorPopover({
  onQueryChange,
  onSelect,
  query,
  rows,
  selectedId,
  triggerLabel,
  totalRuns,
}: {
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  query: string;
  rows: ThreadDataRunIndexEntry[];
  selectedId: string | null;
  triggerLabel: string;
  totalRuns: number;
}): ReactElement {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Database className="size-4" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-[min(420px,88vw)] gap-3 p-3">
        <div>
          <h3 className="text-sm font-semibold">Select Run</h3>
          <p className="text-xs text-muted-foreground">
            {rows.length} shown from {totalRuns} mining runs.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search runs"
          />
        </div>
        <ScrollArea className="max-h-[320px]">
          <div className="overflow-hidden rounded-md border">
            {rows.length ? (
              rows.map((run) => (
                <button
                  key={run.runId}
                  type="button"
                  className={`block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50 ${run.runId === selectedId ? "bg-muted" : ""}`}
                  onClick={() => onSelect(run.runId)}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words text-sm font-medium">{run.label}</span>
                    <Badge className="shrink-0" variant={runStatusTone(run.status)}>
                      {run.status}
                    </Badge>
                  </span>
                  <span className="mt-1 block break-all font-mono text-[11px] text-muted-foreground">
                    {run.runId}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{run.miningMode ?? "historical_backfill"}</span>
                    <span>
                      {run.outputCount}/{run.sourceCount} outputs
                    </span>
                    {run.privacyIssueCount ? <span>{run.privacyIssueCount} privacy</span> : null}
                  </span>
                </button>
              ))
            ) : (
              <p className="p-3 text-sm text-muted-foreground">No matching runs.</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

const THREAD_LINEAGE_KINDS: GraphWorkbenchKind[] = [
  { id: "run", label: "Run", color: "#B45309" },
  { id: "thread", label: "Thread", color: "#2563EB" },
  { id: "workspace", label: "Workspace", color: "#059669" },
  { id: "source-kind", label: "Source Kind", color: "#7C3AED" },
  { id: "session", label: "Session", color: "#64748B" },
];

function safeGraphId(prefix: string, value: string): string {
  return `${prefix}:${value.trim() || "unknown"}`;
}

function compactWorkspaceLabel(cwd: string | undefined): string {
  if (!cwd) return "Unknown workspace";
  const parts = cwd.split("/").filter(Boolean);
  return parts.slice(-2).join("/") || cwd;
}

function buildThreadLineageGraph(input: {
  runDetail: ThreadDataRunDetail | null;
  threads: ThreadDataSource[];
}): { edges: GraphWorkbenchEdge[]; nodes: GraphWorkbenchNode[] } {
  const nodes = new Map<string, GraphWorkbenchNode>();
  const edges = new Map<string, GraphWorkbenchEdge>();

  function upsertNode(node: GraphWorkbenchNode): void {
    const current = nodes.get(node.id);
    nodes.set(node.id, {
      ...current,
      ...node,
      weight: Math.max(current?.weight ?? 0, node.weight ?? 0),
    });
  }

  function addEdge(edge: GraphWorkbenchEdge): void {
    const key = `${edge.source}->${edge.target}:${edge.type ?? "edge"}`;
    if (!edges.has(key)) edges.set(key, edge);
  }

  const runSources = new Set(input.runDetail?.sources.map((source) => source.id) ?? []);
  if (input.runDetail) {
    const run = input.runDetail.run;
    upsertNode({
      id: safeGraphId("run", run.runId),
      kind: "run",
      label: run.label,
      path: run.runId,
      description: `${run.miningMode ?? "historical_backfill"} / ${run.source ?? "backfill"} / ${run.status}`,
      weight: Math.max(1, run.outputCount),
    });
  }

  for (const thread of input.threads) {
    const threadId = safeGraphId("thread", thread.id);
    const workspaceId = safeGraphId("workspace", thread.cwd ?? "unknown");
    const sourceKind = thread.sourceKind ?? "codex_thread";
    const sourceKindId = safeGraphId("source-kind", sourceKind);

    upsertNode({
      id: threadId,
      kind: "thread",
      label: thread.name,
      path: thread.sessionId ?? thread.id,
      description: thread.preview,
      weight: runSources.has(thread.id) ? 3 : 1,
    });
    upsertNode({
      id: workspaceId,
      kind: "workspace",
      label: compactWorkspaceLabel(thread.cwd),
      path: thread.cwd,
      description: "Workspace or project folder associated with the source thread.",
      weight: 1,
    });
    upsertNode({
      id: sourceKindId,
      kind: "source-kind",
      label: sourceKind.replaceAll("_", " "),
      description: "Source adapter that produced this Thread Data row.",
      weight: 1,
    });

    addEdge({
      source: workspaceId,
      target: threadId,
      type: "workspace-thread",
      label: "workspace",
    });
    addEdge({
      source: sourceKindId,
      target: threadId,
      type: "source-kind-thread",
      label: "source kind",
    });

    if (thread.sessionId && thread.sessionId !== thread.id) {
      const sessionId = safeGraphId("session", thread.sessionId);
      upsertNode({
        id: sessionId,
        kind: "session",
        label: thread.sessionId,
        path: thread.sessionId,
        description: "Runtime session id attached to this source row.",
        weight: 1,
      });
      addEdge({
        source: sessionId,
        target: threadId,
        type: "session-thread",
        label: "session",
      });
    }

    if (input.runDetail && runSources.has(thread.id)) {
      addEdge({
        source: safeGraphId("run", input.runDetail.run.runId),
        target: threadId,
        type: "mined-by-run",
        label: "mined source",
      });
    }
  }

  return { edges: [...edges.values()], nodes: [...nodes.values()] };
}

function ForkingPanel({
  runDetail,
  threads,
}: {
  runDetail: ThreadDataRunDetail | null;
  threads: ThreadDataSource[];
}): ReactElement {
  const graph = useMemo(
    () => buildThreadLineageGraph({ runDetail, threads }),
    [runDetail, threads],
  );

  if (!graph.nodes.length) {
    return (
      <section className="grid place-items-center rounded-md border bg-background p-8 text-center">
        <div className="max-w-md">
          <GitFork className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">No thread lineage sources yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Refresh Thread Data or create a mining run to populate source threads and graph edges.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
        <Badge variant="outline">{graph.nodes.length} nodes</Badge>
        <Badge variant="outline">{graph.edges.length} edges</Badge>
        <span>
          Current edges show workspace, source-kind, session, and selected-run source links. True
          created/forked telemetry can attach to this graph next.
        </span>
      </div>
      <GraphWorkbench
        edges={graph.edges}
        kinds={THREAD_LINEAGE_KINDS}
        nodes={graph.nodes}
        searchPlaceholder="Search threads, sessions, workspaces"
        telemetryLabel="Thread Lineage"
      />
    </div>
  );
}

function RunHeader({
  detail,
  progress,
}: {
  detail: ThreadDataRunDetail;
  progress: number;
}): ReactElement {
  const run = detail.run;
  return (
    <section className="grid gap-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 max-w-full break-words text-base font-semibold">{run.label}</h2>
            <Badge className="shrink-0" variant={runStatusTone(run.status)}>
              {run.status}
            </Badge>
            <Badge className="shrink-0" variant="outline">
              {run.miningMode ?? "historical_backfill"}
            </Badge>
            <Badge className="shrink-0" variant="outline">
              {run.source ?? "backfill"}
            </Badge>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{run.runId}</p>
        </div>
        <div className="grid gap-1 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:gap-2">
          <span className="break-words">{formatMiningDate(run.createdAt)}</span>
          {run.completedAt ? (
            <span className="break-words">completed {formatMiningDate(run.completedAt)}</span>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-6">
        <Metric label="sources" value={run.sourceCount} />
        <Metric label="outputs" value={run.outputCount} />
        <Metric label="reviewed" value={run.reviewedCount} />
        <Metric label="promoted" value={run.promotedCount} />
        <Metric label="rejected" value={run.rejectedCount} />
        <Metric label="privacy" value={run.privacyIssueCount ?? 0} />
      </div>
      <Progress value={progress} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function EmptyRunState({ onCreate }: { onCreate: () => void }): ReactElement {
  return (
    <section className="grid place-items-center rounded-md border bg-background p-8 text-center">
      <div className="max-w-md">
        <FolderOpen className="mx-auto size-10 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">No mining runs yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Core has not produced any mining runs for this project yet. Runs are created by Core
          routes, not by this panel.
        </p>
        <Button className="mt-4" onClick={onCreate}>
          <Database className="size-4" />
          Refresh runs
        </Button>
      </div>
    </section>
  );
}

function SourceTable({
  onToggle,
  readonly,
  rows,
  selected,
}: {
  onToggle?: (id: string) => void;
  readonly?: boolean;
  rows: ThreadDataSource[];
  selected: Set<string>;
}): ReactElement {
  const keyCounts = new Map<string, number>();
  return (
    <div className="rounded-md border">
      <ScrollArea className="h-full max-h-[calc(100dvh-260px)]">
        <Table>
          <TableHeader>
            <TableRow>
              {!readonly ? <TableHead className="w-[44px]" /> : null}
              <TableHead>Source</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Workspace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((thread) => (
              <TableRow
                key={occurrenceKey(
                  `${thread.id}:${thread.updatedAt ?? "unknown"}:${thread.cwd ?? ""}`,
                  keyCounts,
                )}
              >
                {!readonly ? (
                  <TableCell>
                    <Checkbox
                      checked={selected.has(thread.id)}
                      onCheckedChange={() => onToggle?.(thread.id)}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="max-w-[420px]">
                  <div className="truncate font-medium">{thread.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{thread.preview}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatMiningDate(thread.updatedAt)}
                </TableCell>
                <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">
                  {thread.cwd ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function ArtifactInspector({
  artifacts,
  onSelect,
  selectedArtifact,
  selectedArtifactId,
}: {
  artifacts: ThreadDataArtifact[];
  onSelect: (id: string) => void;
  selectedArtifact: ThreadDataArtifact | null;
  selectedArtifactId: string;
}): ReactElement {
  const reportArtifacts = artifacts.filter((artifact) => artifactGroup(artifact) === "report");
  const debugArtifacts = artifacts.filter((artifact) => artifactGroup(artifact) === "debug");
  return (
    <div className="grid h-full min-h-0 gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="rounded-md border">
        <ScrollArea className="h-full max-h-[calc(100dvh-260px)]">
          <ArtifactGroupList
            artifacts={reportArtifacts}
            label="Report Files"
            selectedArtifactId={selectedArtifactId}
            onSelect={onSelect}
          />
          <ArtifactGroupList
            artifacts={debugArtifacts}
            label="Debug Files"
            selectedArtifactId={selectedArtifactId}
            onSelect={onSelect}
          />
        </ScrollArea>
      </div>
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-md border bg-background">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold">{selectedArtifact?.label ?? "Artifact"}</h3>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {selectedArtifact?.path ?? "No path"}
          </p>
        </div>
        <ScrollArea className="min-h-0 p-3">
          <ArtifactPreview artifact={selectedArtifact} />
        </ScrollArea>
      </div>
    </div>
  );
}

function ArtifactGroupList({
  artifacts,
  label,
  onSelect,
  selectedArtifactId,
}: {
  artifacts: ThreadDataArtifact[];
  label: string;
  onSelect: (id: string) => void;
  selectedArtifactId: string;
}): ReactElement | null {
  if (!artifacts.length) return null;
  return (
    <div className="border-b last:border-b-0">
      <div className="px-3 py-2 text-[11px] font-medium uppercase text-muted-foreground">
        {label}
      </div>
      {artifacts.map((artifact) => (
        <button
          key={artifact.id}
          type="button"
          className={`block w-full border-t px-3 py-2 text-left text-sm hover:bg-muted/50 ${artifact.id === selectedArtifactId ? "bg-muted" : ""}`}
          onClick={() => onSelect(artifact.id)}
        >
          <span className="flex items-center gap-2">
            <Badge variant={artifactTone(artifact.kind)}>{artifact.kind}</Badge>
            <span className="truncate">{artifact.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function ArtifactPreview({ artifact }: { artifact: ThreadDataArtifact | null }): ReactElement {
  if (!artifact) return <p className="text-sm text-muted-foreground">No artifact selected.</p>;
  const json = parseArtifactJson(artifact);
  if (json !== null) {
    return (
      <div className="grid gap-3">
        <JsonArtifactSummary value={json} />
        <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 text-xs [overflow-wrap:anywhere]">
          {artifactPreviewText(artifact)}
        </pre>
      </div>
    );
  }
  return (
    <pre className="whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere]">
      {artifactPreviewText(artifact)}
    </pre>
  );
}

function JsonArtifactSummary({ value }: { value: unknown }): ReactElement {
  if (Array.isArray(value)) {
    return (
      <div className="rounded-md border bg-background p-3">
        <div className="text-xs font-medium uppercase text-muted-foreground">JSON Summary</div>
        <p className="mt-1 text-sm">{value.length} top-level items</p>
      </div>
    );
  }
  if (!value || typeof value !== "object") {
    return (
      <div className="rounded-md border bg-background p-3">
        <div className="text-xs font-medium uppercase text-muted-foreground">JSON Value</div>
        <p className="mt-1 text-sm">{shortJsonValue(value)}</p>
      </div>
    );
  }
  const entries = Object.entries(value).slice(0, 12);
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">JSON Summary</div>
      <div className="grid gap-2 md:grid-cols-2">
        {entries.map(([key, entryValue]) => (
          <div key={key} className="min-w-0 rounded border bg-muted/20 px-2 py-1.5">
            <div className="truncate font-mono text-[11px] text-muted-foreground">{key}</div>
            <div className="truncate text-xs">{shortJsonValue(entryValue)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttemptTimeline({ attempts }: { attempts: Array<Record<string, unknown>> }): ReactElement {
  if (!attempts.length)
    return <p className="text-sm text-muted-foreground">No attempts recorded.</p>;
  return (
    <div className="grid gap-2">
      {attempts.map((attempt, index) => (
        <div
          key={String(attempt.attemptId ?? index)}
          className="rounded-md border bg-background p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-sm">
              {String(attempt.attemptId ?? `attempt-${index + 1}`)}
            </span>
            <Badge variant={String(attempt.status) === "complete" ? "default" : "outline"}>
              {String(attempt.status ?? "unknown")}
            </Badge>
          </div>
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-3">
            <span>{String(attempt.executorKind ?? "local_worker")}</span>
            <span>{String(attempt.startedAt ?? "unknown")}</span>
            <span>{String(attempt.reason ?? "initial_run")}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgramEditor({
  draft,
  onSelect,
  programs,
  selectedId,
}: {
  draft: ProgramDraft;
  onSelect: (id: string) => void;
  programs: ThreadDataProgram[];
  selectedId: string;
}): ReactElement {
  return (
    <div className="grid h-full min-h-0 gap-3 md:grid-cols-[280px_minmax(0,1fr)]">
      <div className="rounded-md border">
        <ScrollArea className="h-full max-h-[calc(100dvh-260px)]">
          {programs.map((program) => (
            <button
              key={program.id}
              type="button"
              className={`block w-full border-b px-3 py-2 text-left text-sm hover:bg-muted/50 ${program.id === selectedId ? "bg-muted" : ""}`}
              onClick={() => onSelect(program.id)}
            >
              <span className="block font-medium">{program.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {program.id} v{program.version}
              </span>
            </button>
          ))}
        </ScrollArea>
      </div>
      <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 rounded-md border bg-background p-3">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">Immutable Core program</Badge>
          <span className="text-xs text-muted-foreground">Inspect only</span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <ReadOnlyField label="ID" value={draft.id} />
          <ReadOnlyField label="Name" value={draft.name} />
          <ReadOnlyField label="Version" value={draft.version} />
        </div>
        <ReadOnlyField label="Objective" value={draft.objective} />
        <Textarea
          className="min-h-[280px] resize-none font-mono text-xs"
          value={draft.prompt}
          readOnly
        />
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Input readOnly value={value} />
    </div>
  );
}

function OutputTable({
  onOpen,
  rows,
}: {
  onOpen: (id: string) => void;
  rows: ThreadDataRunDetail["outputs"];
}): ReactElement {
  const keyCounts = new Map<string, number>();
  return (
    <div className="rounded-md border">
      <ScrollArea className="h-full max-h-[calc(100dvh-300px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead>Redaction</TableHead>
              <TableHead>Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((output) => (
              <TableRow
                key={occurrenceKey(
                  `${output.id}:${output.outputJsonPath}:${output.sessionId}`,
                  keyCounts,
                )}
                className="cursor-pointer"
                onClick={() => onOpen(output.id)}
              >
                <TableCell className="max-w-[260px] truncate">{output.sourceTitle}</TableCell>
                <TableCell className="font-mono text-xs">{output.ticketId ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{output.verdict}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={output.redactionStatus === "clean" ? "secondary" : "outline"}>
                    {output.redactionStatus}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[560px] truncate text-xs text-muted-foreground">
                  {output.summary}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function OutputDetailScreen({
  mode,
  onBack,
  onModeChange,
  onVerdict,
  output,
  redactionMarkdown,
  run,
  scorecard,
  selectedOutputDecisionsText,
  selectedOutputEvidenceRows,
  selectedOutputJsonText,
}: {
  mode: OutputViewMode;
  onBack: () => void;
  onModeChange: (mode: OutputViewMode) => void;
  onVerdict: (verdict: ThreadDataRunOutput["verdict"]) => Promise<void>;
  output: ThreadDataRunOutput | null;
  redactionMarkdown?: string;
  run: ThreadDataRunIndexEntry | null;
  scorecard: ReturnType<typeof scorecardSummary>;
  selectedOutputDecisionsText: string;
  selectedOutputEvidenceRows: MiningEvidenceRow[];
  selectedOutputJsonText: string;
}): ReactElement {
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-md border bg-background">
      <header className="border-b p-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Button size="icon" variant="ghost" aria-label="Back to outputs" onClick={onBack}>
                <ArrowLeft className="size-4" />
              </Button>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">
                  {output?.sourceTitle ?? "Output"}
                </h2>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  {run?.runId ?? "run"} / {output?.id ?? "output"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{output?.ticketId ?? "no ticket"}</Badge>
            <Badge variant={output?.verdict === "promoted" ? "default" : "outline"}>
              {output?.verdict ?? "unreviewed"}
            </Badge>
            <Badge variant={output?.redactionStatus === "clean" ? "secondary" : "outline"}>
              {output?.redactionStatus ?? "unknown"}
            </Badge>
          </div>
        </div>
      </header>
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <ModeButton active={mode === "summary"} onClick={() => onModeChange("summary")}>
            Summary
          </ModeButton>
          <ModeButton active={mode === "evidence"} onClick={() => onModeChange("evidence")}>
            Evidence
          </ModeButton>
          <ModeButton active={mode === "decisions"} onClick={() => onModeChange("decisions")}>
            Decisions
          </ModeButton>
          <ModeButton active={mode === "markdown"} onClick={() => onModeChange("markdown")}>
            Markdown
          </ModeButton>
          <ModeButton active={mode === "json"} onClick={() => onModeChange("json")}>
            JSON
          </ModeButton>
          <ModeButton active={mode === "redaction"} onClick={() => onModeChange("redaction")}>
            Redaction
          </ModeButton>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Badge variant="outline">{output?.verdict ?? "unreviewed"}</Badge>
          <Button size="sm" variant="outline" onClick={() => void onVerdict("unreviewed")}>
            <ListChecks className="size-4" />
            Unreview
          </Button>
          <Button size="sm" variant="outline" onClick={() => void onVerdict("rejected")}>
            Reject
          </Button>
          <Button
            size="sm"
            variant={output?.redactionStatus === "clean" ? "default" : "outline"}
            onClick={() => void onVerdict("promoted")}
            disabled={output?.redactionStatus !== "clean"}
          >
            Promote
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 bg-muted/20 p-3">
        {mode === "summary" ? <ScorecardView output={output} scorecard={scorecard} /> : null}
        {mode === "markdown" ? (
          <PreBlock text={output?.outputMarkdown ?? "No output selected."} />
        ) : null}
        {mode === "json" ? <PreBlock text={selectedOutputJsonText} /> : null}
        {mode === "decisions" ? <PreBlock text={selectedOutputDecisionsText} /> : null}
        {mode === "evidence" ? <EvidenceList rows={selectedOutputEvidenceRows} /> : null}
        {mode === "redaction" ? (
          <PreBlock text={redactionMarkdown ?? "No redaction report selected."} />
        ) : null}
      </ScrollArea>
    </section>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}): ReactElement {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} onClick={onClick}>
      {children}
    </Button>
  );
}

function ScorecardView({
  output,
  scorecard,
}: {
  output: ThreadDataRunOutput | null;
  scorecard: ReturnType<typeof scorecardSummary>;
}): ReactElement {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-3">
        <ScoreMetric
          icon={<CheckCircle2 className="size-4" />}
          label="Scope"
          value={scorecard?.scopeFollowed ?? "unknown"}
        />
        <ScoreMetric
          icon={<CheckSquare className="size-4" />}
          label="Proof"
          value={scorecard?.proofQuality ?? "unknown"}
        />
        <ScoreMetric
          icon={<ShieldAlert className="size-4" />}
          label="Skipped"
          value={scorecard?.skippedSteps ?? "none"}
        />
      </div>
      <div className="rounded-md border bg-background p-3">
        <h3 className="text-sm font-semibold">Summary</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {scorecard?.overallScore !== undefined ? `Score: ${scorecard.overallScore}/100\n` : ""}
          {scorecard?.overall ?? output?.summary ?? "No scorecard summary available."}
        </p>
      </div>
      {scorecard?.skillTrace ? (
        <div className="rounded-md border bg-background p-3">
          <div className="mb-3 flex items-center gap-2">
            <ListChecks className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Skill Trace</h3>
          </div>
          {scorecard.skillTraceSummary ? (
            <p className="mb-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {scorecard.skillTraceSummary}
            </p>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2">
            <ScoreMetric
              icon={<CheckCircle2 className="size-4" />}
              label="Skill Loaded"
              value={scorecard.skillTrace.skillLoaded ?? "unknown"}
            />
            <ScoreMetric
              icon={<RefreshCw className="size-4" />}
              label="Load Timing"
              value={scorecard.skillTrace.skillLoadTiming ?? "unknown"}
            />
            <ScoreMetric
              icon={<ShieldAlert className="size-4" />}
              label="Missed Triggers"
              value={
                scorecard.skillTrace.missedTriggers.length
                  ? scorecard.skillTrace.missedTriggers.join(", ")
                  : "none"
              }
            />
            <ScoreMetric
              icon={<ShieldAlert className="size-4" />}
              label="False Positives"
              value={
                scorecard.skillTrace.falsePositiveTriggers.length
                  ? scorecard.skillTrace.falsePositiveTriggers.join(", ")
                  : "none"
              }
            />
            <ScoreMetric
              icon={<GitFork className="size-4" />}
              label="Wasted Steps"
              value={scorecard.skillTrace.wastedSteps ?? "unknown"}
            />
            <ScoreMetric
              icon={<CheckSquare className="size-4" />}
              label="Default Followed"
              value={scorecard.skillTrace.defaultFollowed ?? "unknown"}
            />
            <ScoreMetric
              icon={<FileText className="size-4" />}
              label="Reference Loads"
              value={String(scorecard.skillTrace.referenceLoadCount)}
            />
            <ScoreMetric
              icon={<ListChecks className="size-4" />}
              label="Skill Delta Candidates"
              value={String(scorecard.skillTrace.traceToSkillDeltaCount)}
            />
          </div>
          {scorecard.skillTrace.limitations.length ? (
            <div className="mt-3 rounded-md border bg-muted/30 p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Limits</div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {scorecard.skillTrace.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ScoreMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function EvidenceList({ rows }: { rows: MiningEvidenceRow[] }): ReactElement {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No evidence spans recorded.</p>;
  }
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-md border bg-background/80 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{row.id}</Badge>
            <Badge variant={row.role === "user" ? "secondary" : "outline"}>{row.role}</Badge>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
            {row.text}
          </p>
          <p className="mt-2 break-words font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
            {row.source}
          </p>
        </div>
      ))}
    </div>
  );
}

function PreBlock({ text }: { text: string }): ReactElement {
  return (
    <pre className="whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere]">{text}</pre>
  );
}

function occurrenceKey(base: string, counts: Map<string, number>): string {
  const nextCount = (counts.get(base) ?? 0) + 1;
  counts.set(base, nextCount);
  return nextCount === 1 ? base : `${base}:${nextCount}`;
}
