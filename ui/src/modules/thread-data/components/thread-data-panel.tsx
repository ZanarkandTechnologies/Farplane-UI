"use client";

/**
 * Thread Data mining cockpit
 * Inputs: local Codex thread summaries plus .farplane/mine program and run artifacts.
 * Outputs: run-first mining cockpit, source setup drawer, artifact inspection, and output review.
 * Side effects: writes mining artifacts and verdicts through the Vite state bridge.
 */

import {
  CheckCircle2,
  CheckSquare,
  Database,
  FileText,
  FolderOpen,
  GitFork,
  ListChecks,
  Play,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
} from "lucide-react";
import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  artifactPreview,
  artifactTone,
  defaultOutputViewMode,
  filterOutputs,
  filterThreads,
  formatMiningDate,
  outputEvidenceRows,
  runStatusTone,
  scorecardSummary,
  selectedThreadIds,
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
type RunTab = "outputs" | "artifacts" | "attempts" | "program" | "sources";
type ThreadDataTab = "review" | "programs" | "sources" | "forking";

function draftFromProgram(program: ThreadDataProgram | null): ProgramDraft {
  return {
    id: program?.id ?? "custom-v1",
    name: program?.name ?? "Custom mining program",
    version: program?.version ?? "1.0.0",
    objective: program?.objective ?? "Extract structured findings from old Codex threads.",
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

export function ThreadDataPanel(): ReactElement {
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
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [isNewRunOpen, setIsNewRunOpen] = useState(false);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState("report");
  const [runTab, setRunTab] = useState<RunTab>("outputs");
  const [threadDataTab, setThreadDataTab] = useState<ThreadDataTab>("review");
  const [outputViewMode, setOutputViewMode] = useState<OutputViewMode>("summary");

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
    () => scorecardSummary(selectedOutput?.outputJson),
    [selectedOutput?.outputJson],
  );

  const runProgress = useMemo(() => {
    if (!runDetail?.run.sourceCount) return 0;
    return Math.round((runDetail.run.outputCount / runDetail.run.sourceCount) * 100);
  }, [runDetail?.run.outputCount, runDetail?.run.sourceCount]);

  const loadRun = useCallback(async (runId: string): Promise<void> => {
    const payload = await fetchJson<ThreadDataRunResponse>(
      `/farplane/mine/runs/${encodeURIComponent(runId)}`,
    );
    setSelectedRunId(runId);
    setRunDetail(payload.detail);
    setSelectedArtifactId(payload.detail?.artifacts?.[0]?.id ?? "report");
    setRunTab("outputs");
    setStatus(`Loaded run ${runId}`);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setError(null);
    setStatus("Refreshing mining runs...");
    try {
      const [programPayload, threadPayload, runPayload] = await Promise.all([
        fetchJson<ThreadDataProgramsResponse>("/farplane/mine/programs"),
        fetchJson<ThreadDataThreadsResponse>(
          `/farplane/mine/threads?limit=${DEFAULT_THREAD_LIMIT}`,
        ),
        fetchJson<ThreadDataRunsResponse>("/farplane/mine/runs"),
      ]);
      const nextPrograms = programPayload.programs;
      const nextRuns = sortMiningRuns(runPayload.runs ?? []);
      setPrograms(nextPrograms);
      setThreads(threadPayload.threads ?? []);
      setRuns(nextRuns);
      const nextProgramId = selectedProgramId || nextPrograms[0]?.id || "";
      setSelectedProgramId(nextProgramId);
      setProgramDraft(
        draftFromProgram(nextPrograms.find((program) => program.id === nextProgramId) ?? null),
      );
      const runToLoad = selectedRunId ?? runPayload.latest?.runId ?? null;
      if (runToLoad) {
        await loadRun(runToLoad);
      } else {
        setRunDetail(null);
        setStatus("No mining runs yet.");
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "thread_data_refresh_failed");
      setStatus("Mining runs unavailable.");
    }
  }, [loadRun, selectedProgramId, selectedRunId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const saveProgram = async (): Promise<void> => {
    setStatus(`Saving ${programDraft.id}...`);
    setError(null);
    try {
      const payload = await fetchJson<ThreadDataProgramsResponse>("/farplane/mine/programs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-farplane-actor-role": "operator",
        },
        body: JSON.stringify({
          ...programDraft,
          outputMode: "markdown-json",
        }),
      });
      setPrograms(payload.programs);
      setSelectedProgramId(programDraft.id);
      setStatus(`Saved program ${programDraft.id}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "program_save_failed");
      setStatus("Program save failed.");
    }
  };

  const startRun = async (): Promise<void> => {
    if (!selectedProgramId) return;
    setStatus("Creating mining run...");
    setError(null);
    try {
      const payload = await fetchJson<ThreadDataRunResponse>("/farplane/mine/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-farplane-actor-role": "operator",
        },
        body: JSON.stringify({
          programId: selectedProgramId,
          threadIds: selectedThreadIds(threads, selectedThreadSet),
          filters: {
            lastDays: Number(lastDays) || 30,
            limit: Number(sourceLimit) || 20,
          },
        }),
      });
      if (payload.detail) {
        const detail = payload.detail;
        setRunDetail(detail);
        setSelectedRunId(detail.run.runId);
        setRuns((current) =>
          sortMiningRuns([detail.run, ...current.filter((run) => run.runId !== detail.run.runId)]),
        );
        setIsNewRunOpen(false);
        setRunTab("outputs");
        setStatus(`Created run ${detail.run.runId}`);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "mining_run_failed");
      setStatus("Mining run creation failed.");
    }
  };

  const replayRun = async (): Promise<void> => {
    if (!selectedRunId) return;
    setStatus(`Replaying ${selectedRunId}...`);
    setError(null);
    try {
      const payload = await fetchJson<ThreadDataRunResponse>(
        `/farplane/mine/runs/${encodeURIComponent(selectedRunId)}/replay`,
        {
          method: "POST",
          headers: { "x-farplane-actor-role": "operator" },
        },
      );
      if (payload.detail) {
        const detail = payload.detail;
        setRunDetail(detail);
        setRuns((current) =>
          sortMiningRuns([detail.run, ...current.filter((run) => run.runId !== detail.run.runId)]),
        );
        setRunTab("attempts");
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
    setOutputViewMode(defaultOutputViewMode(runDetail?.run, nextOutput));
    setIsOutputOpen(true);
  };

  const setOutputVerdict = async (verdict: ThreadDataRunOutput["verdict"]): Promise<void> => {
    if (!selectedRunId || !selectedOutputId) return;
    setStatus(`Marking ${selectedOutputId} ${verdict}...`);
    setError(null);
    try {
      const payload = await fetchJson<ThreadDataRunResponse>(
        `/farplane/mine/runs/${encodeURIComponent(selectedRunId)}/outputs/${encodeURIComponent(selectedOutputId)}/verdict`,
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
            <h1 className="text-lg font-semibold tracking-normal">Mining Runs</h1>
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
          <Button size="sm" variant="outline" onClick={() => setIsNewRunOpen(true)}>
            <Database className="size-4" />
            New run
          </Button>
          <Button size="sm" onClick={() => void replayRun()} disabled={!selectedRunId}>
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
            {runDetail ? (
              <section className="grid min-w-0 min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
                <RunHeader detail={runDetail} progress={runProgress} />
                <Tabs
                  value={runTab}
                  onValueChange={(value) => setRunTab(value as RunTab)}
                  className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]"
                >
                  <TabsList className="max-w-full overflow-x-auto">
                    <TabsTrigger value="outputs">Outputs</TabsTrigger>
                    <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
                    <TabsTrigger value="attempts">Attempts</TabsTrigger>
                    <TabsTrigger value="program">Program</TabsTrigger>
                    <TabsTrigger value="sources">Sources</TabsTrigger>
                  </TabsList>
                  <TabsContent value="outputs" className="min-h-0">
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
                  </TabsContent>
                  <TabsContent value="artifacts" className="min-h-0">
                    <ArtifactInspector
                      artifacts={runDetail.artifacts ?? []}
                      selectedArtifact={selectedArtifact}
                      selectedArtifactId={selectedArtifactId}
                      onSelect={setSelectedArtifactId}
                    />
                  </TabsContent>
                  <TabsContent value="attempts" className="min-h-0">
                    <AttemptTimeline attempts={runDetail.attempts ?? []} />
                  </TabsContent>
                  <TabsContent value="program" className="min-h-0">
                    <ProgramEditor
                      draft={programDraft}
                      programs={programs}
                      selectedId={selectedProgramId}
                      onDraftChange={setProgramDraft}
                      onSave={() => void saveProgram()}
                      onSelect={setSelectedProgramId}
                    />
                  </TabsContent>
                  <TabsContent value="sources" className="min-h-0">
                    <SourceTable rows={runDetail.sources} selected={new Set()} readonly />
                  </TabsContent>
                </Tabs>
              </section>
            ) : (
              <EmptyRunState onCreate={() => setIsNewRunOpen(true)} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="programs" className="min-h-0">
          <ProgramEditor
            draft={programDraft}
            programs={programs}
            selectedId={selectedProgramId}
            onDraftChange={setProgramDraft}
            onSave={() => void saveProgram()}
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
              <Button onClick={() => setIsNewRunOpen(true)}>
                <Play className="size-4" />
                New run
              </Button>
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

      <NewRunSheet
        isOpen={isNewRunOpen}
        lastDays={lastDays}
        programs={programs}
        selectedProgram={selectedProgram}
        selectedProgramId={selectedProgramId}
        selectedThreadSet={selectedThreadSet}
        sourceLimit={sourceLimit}
        threadQuery={threadQuery}
        threads={visibleThreads}
        totalThreads={threads.length}
        onLastDaysChange={setLastDays}
        onOpenChange={setIsNewRunOpen}
        onProgramSelect={setSelectedProgramId}
        onRun={() => void startRun()}
        onSelectVisible={selectVisibleThreads}
        onSourceLimitChange={setSourceLimit}
        onThreadQueryChange={setThreadQuery}
        onToggleThread={toggleThread}
      />

      <OutputReviewSheet
        isOpen={isOutputOpen}
        mode={outputViewMode}
        output={selectedOutput}
        redactionMarkdown={selectedOutput?.redactionMarkdown}
        scorecard={selectedScorecard}
        selectedOutputDecisionsText={selectedOutputDecisionsText}
        selectedOutputEvidenceRows={selectedOutputEvidenceRows}
        selectedOutputJsonText={selectedOutputJsonText}
        onModeChange={setOutputViewMode}
        onOpenChange={setIsOutputOpen}
        onVerdict={setOutputVerdict}
      />
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
          Create a run to write input, sources, attempts, reports, and outputs under
          `.farplane/mine/runs/&lt;run-id&gt;`.
        </p>
        <Button className="mt-4" onClick={onCreate}>
          <Database className="size-4" />
          Create first run
        </Button>
      </div>
    </section>
  );
}

function NewRunSheet({
  isOpen,
  lastDays,
  onLastDaysChange,
  onOpenChange,
  onProgramSelect,
  onRun,
  onSelectVisible,
  onSourceLimitChange,
  onThreadQueryChange,
  onToggleThread,
  programs,
  selectedProgram,
  selectedProgramId,
  selectedThreadSet,
  sourceLimit,
  threadQuery,
  threads,
  totalThreads,
}: {
  isOpen: boolean;
  lastDays: string;
  onLastDaysChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onProgramSelect: (id: string) => void;
  onRun: () => void;
  onSelectVisible: () => void;
  onSourceLimitChange: (value: string) => void;
  onThreadQueryChange: (value: string) => void;
  onToggleThread: (id: string) => void;
  programs: ThreadDataProgram[];
  selectedProgram: ThreadDataProgram | null;
  selectedProgramId: string;
  selectedThreadSet: Set<string>;
  sourceLimit: string;
  threadQuery: string;
  threads: ThreadDataSource[];
  totalThreads: number;
}): ReactElement {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="grid w-[min(980px,94vw)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>New Mining Run</SheetTitle>
          <SheetDescription>
            Select a program and sources. The run will become a replayable folder under
            `.farplane/mine`.
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 gap-3 px-4 md:grid-cols-[260px_minmax(0,1fr)]">
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div>
              <Label className="text-xs">Program</Label>
              <p className="mt-1 truncate text-sm font-medium">
                {selectedProgram?.name ?? "No program"}
              </p>
            </div>
            <ScrollArea className="rounded-md border">
              {programs.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  className={`block w-full border-b px-3 py-2 text-left text-sm hover:bg-muted/50 ${program.id === selectedProgramId ? "bg-muted" : ""}`}
                  onClick={() => onProgramSelect(program.id)}
                >
                  <span className="block font-medium">{program.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {program.id} v{program.version}
                  </span>
                </button>
              ))}
            </ScrollArea>
          </div>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="grid gap-2 md:grid-cols-[1fr_100px_100px_auto]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={threadQuery}
                  onChange={(event) => onThreadQueryChange(event.target.value)}
                  placeholder="Search sources, tickets, workspaces"
                />
              </div>
              <Input value={lastDays} onChange={(event) => onLastDaysChange(event.target.value)} />
              <Input
                value={sourceLimit}
                onChange={(event) => onSourceLimitChange(event.target.value)}
              />
              <Button variant="outline" onClick={onSelectVisible}>
                Select visible
              </Button>
            </div>
            <SourceTable rows={threads} selected={selectedThreadSet} onToggle={onToggleThread} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {selectedThreadSet.size || Math.min(10, totalThreads)} selected by default from{" "}
            {totalThreads} sources.
          </p>
          <Button onClick={onRun} disabled={!selectedProgramId}>
            <Play className="size-4" />
            Start run
          </Button>
        </div>
      </SheetContent>
    </Sheet>
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
  return (
    <div className="grid h-full min-h-0 gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="rounded-md border">
        <ScrollArea className="h-full max-h-[calc(100dvh-260px)]">
          {artifacts.map((artifact) => (
            <button
              key={artifact.id}
              type="button"
              className={`block w-full border-b px-3 py-2 text-left text-sm hover:bg-muted/50 ${artifact.id === selectedArtifactId ? "bg-muted" : ""}`}
              onClick={() => onSelect(artifact.id)}
            >
              <span className="flex items-center gap-2">
                <Badge variant={artifactTone(artifact.kind)}>{artifact.kind}</Badge>
                <span className="truncate">{artifact.label}</span>
              </span>
            </button>
          ))}
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
          <pre className="whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere]">
            {artifactPreview(selectedArtifact)}
          </pre>
        </ScrollArea>
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
  onDraftChange,
  onSave,
  onSelect,
  programs,
  selectedId,
}: {
  draft: ProgramDraft;
  onDraftChange: (draft: ProgramDraft) => void;
  onSave: () => void;
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
      <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 rounded-md border bg-background p-3">
        <div className="grid gap-2 md:grid-cols-3">
          <Field
            label="ID"
            value={draft.id}
            onChange={(value) => onDraftChange({ ...draft, id: value })}
          />
          <Field
            label="Name"
            value={draft.name}
            onChange={(value) => onDraftChange({ ...draft, name: value })}
          />
          <Field
            label="Version"
            value={draft.version}
            onChange={(value) => onDraftChange({ ...draft, version: value })}
          />
        </div>
        <Field
          label="Objective"
          value={draft.objective}
          onChange={(value) => onDraftChange({ ...draft, objective: value })}
        />
        <Textarea
          className="min-h-[280px] resize-none font-mono text-xs"
          value={draft.prompt}
          onChange={(event) => onDraftChange({ ...draft, prompt: event.target.value })}
        />
        <Button className="w-fit" onClick={onSave}>
          <Save className="size-4" />
          Save program
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}): ReactElement {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
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

function OutputReviewSheet({
  isOpen,
  mode,
  onModeChange,
  onOpenChange,
  onVerdict,
  output,
  redactionMarkdown,
  scorecard,
  selectedOutputDecisionsText,
  selectedOutputEvidenceRows,
  selectedOutputJsonText,
}: {
  isOpen: boolean;
  mode: OutputViewMode;
  onModeChange: (mode: OutputViewMode) => void;
  onOpenChange: (open: boolean) => void;
  onVerdict: (verdict: ThreadDataRunOutput["verdict"]) => Promise<void>;
  output: ThreadDataRunOutput | null;
  redactionMarkdown?: string;
  scorecard: ReturnType<typeof scorecardSummary>;
  selectedOutputDecisionsText: string;
  selectedOutputEvidenceRows: MiningEvidenceRow[];
  selectedOutputJsonText: string;
}): ReactElement {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(960px,94vw)] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>{output?.sourceTitle ?? "Output"}</SheetTitle>
          <SheetDescription>
            Review mined output, evidence, redaction, and verdict.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap items-center gap-2 px-4">
          <Badge variant="outline">{output?.verdict ?? "unreviewed"}</Badge>
          <Badge variant={output?.redactionStatus === "clean" ? "secondary" : "outline"}>
            {output?.redactionStatus ?? "unknown"}
          </Badge>
          <div className="ml-2 flex flex-wrap items-center gap-1 border-l pl-3">
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
        <ScrollArea className="mt-2 h-[calc(100dvh-155px)] rounded-md border bg-muted/20 p-3">
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
      </SheetContent>
    </Sheet>
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
          {scorecard?.overall ?? output?.summary ?? "No scorecard summary available."}
        </p>
      </div>
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
