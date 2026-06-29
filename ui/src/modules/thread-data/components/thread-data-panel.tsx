"use client";

/**
 * Thread Data panel
 * Inputs: local Codex thread summaries plus .farplane/mine program and run artifacts.
 * Outputs: selectable source threads, program CRUD, mining run creation, and output browsing.
 * Side effects: writes mining artifacts through the Vite state bridge.
 */

import {
  CheckSquare,
  Database,
  FileText,
  GitFork,
  ListChecks,
  Play,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { MiningEvidenceRow } from "@/modules/thread-data/lib/mining-artifacts";
import {
  filterOutputs,
  filterThreads,
  formatMiningDate,
  outputEvidenceRows,
  runStatusTone,
  selectedThreadIds,
  sortMiningRuns,
} from "@/modules/thread-data/lib/mining-artifacts";
import type {
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

type ProgramDraft = {
  id: string;
  name: string;
  version: string;
  objective: string;
  prompt: string;
};

type OutputViewMode = "markdown" | "decisions" | "evidence" | "json" | "redaction";

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
  const [outputQuery, setOutputQuery] = useState("");
  const [lastDays, setLastDays] = useState("30");
  const [sourceLimit, setSourceLimit] = useState("20");
  const [status, setStatus] = useState("Loading thread data...");
  const [error, setError] = useState<string | null>(null);
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(draftFromProgram(null));
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [outputViewMode, setOutputViewMode] = useState<OutputViewMode>("markdown");

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );

  const selectedOutput = useMemo(
    () => runDetail?.outputs.find((output) => output.id === selectedOutputId) ?? null,
    [runDetail?.outputs, selectedOutputId],
  );

  const visibleThreads = useMemo(() => filterThreads(threads, threadQuery), [threads, threadQuery]);

  const visibleOutputs = useMemo(
    () => filterOutputs(runDetail?.outputs ?? [], outputQuery),
    [outputQuery, runDetail?.outputs],
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
    setStatus(`Loaded run ${runId}`);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setError(null);
    setStatus("Refreshing thread data...");
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
      setStatus("Thread data unavailable.");
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
        setStatus(`Created run ${detail.run.runId}`);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "mining_run_failed");
      setStatus("Mining run creation failed.");
    }
  };

  const openOutput = (outputId: string): void => {
    setSelectedOutputId(outputId);
    setOutputViewMode("decisions");
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

  return (
    <div
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3"
      data-testid="thread-data-panel"
    >
      <header className="grid gap-3 rounded-md border bg-background/80 p-3 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-normal">Thread Data</h1>
            <Badge variant="outline">{programs.length} programs</Badge>
            <Badge variant="outline">{threads.length} threads</Badge>
            <Badge variant="outline">{runs.length} runs</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{status}</p>
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => void startRun()} disabled={!selectedProgramId}>
            <Play className="size-4" />
            Run mining
          </Button>
        </div>
      </header>

      <Tabs defaultValue="threads" className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <TabsList className="w-fit">
          <TabsTrigger value="threads">
            <Database className="mr-2 size-4" />
            Threads
          </TabsTrigger>
          <TabsTrigger value="forking">
            <GitFork className="mr-2 size-4" />
            Forking
          </TabsTrigger>
          <TabsTrigger value="programs">
            <FileText className="mr-2 size-4" />
            Programs
          </TabsTrigger>
          <TabsTrigger value="mine">
            <Play className="mr-2 size-4" />
            Mine
          </TabsTrigger>
          <TabsTrigger value="runs">
            <CheckSquare className="mr-2 size-4" />
            Runs
          </TabsTrigger>
          <TabsTrigger value="outputs">Outputs</TabsTrigger>
        </TabsList>

        <TabsContent value="threads" className="min-h-0">
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="grid gap-2 rounded-md border bg-muted/20 p-3 md:grid-cols-[1fr_120px_120px_auto]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={threadQuery}
                  onChange={(event) => setThreadQuery(event.target.value)}
                  placeholder="Search threads, tickets, paths"
                />
              </div>
              <Input
                value={lastDays}
                onChange={(event) => setLastDays(event.target.value)}
                aria-label="Last days"
              />
              <Input
                value={sourceLimit}
                onChange={(event) => setSourceLimit(event.target.value)}
                aria-label="Source limit"
              />
              <Button variant="outline" onClick={selectVisibleThreads}>
                Select visible
              </Button>
            </div>
            <ThreadTable
              rows={visibleThreads}
              selected={selectedThreadSet}
              onToggle={toggleThread}
            />
          </div>
        </TabsContent>

        <TabsContent value="forking" className="min-h-0">
          <div className="grid h-full min-h-0 gap-3 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-md border">
              <ScrollArea className="h-full max-h-[calc(100dvh-220px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thread</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead>Workspace</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {threads.slice(0, 80).map((thread) => (
                      <TableRow key={thread.id}>
                        <TableCell className="max-w-[360px] truncate">{thread.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {thread.sessionId ?? thread.id}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">
                          {thread.cwd ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <h2 className="text-sm font-semibold">Forking contract</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                A mining run writes `parent-prompt.md` so a Codex parent job can fan out one worker
                per selected session.
              </p>
              <pre className="mt-3 max-h-[360px] overflow-auto rounded-md border bg-background p-3 text-xs">
                {runDetail?.parentPrompt ?? "Create a run to generate the parent prompt."}
              </pre>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="programs" className="min-h-0">
          <div className="grid h-full min-h-0 gap-3 md:grid-cols-[280px_minmax(0,1fr)]">
            <ProgramList
              rows={programs}
              selectedId={selectedProgramId}
              onSelect={setSelectedProgramId}
            />
            <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 rounded-md border bg-background p-3">
              <div className="grid gap-2 md:grid-cols-3">
                <Field
                  label="ID"
                  value={programDraft.id}
                  onChange={(value) => setProgramDraft((draft) => ({ ...draft, id: value }))}
                />
                <Field
                  label="Name"
                  value={programDraft.name}
                  onChange={(value) => setProgramDraft((draft) => ({ ...draft, name: value }))}
                />
                <Field
                  label="Version"
                  value={programDraft.version}
                  onChange={(value) => setProgramDraft((draft) => ({ ...draft, version: value }))}
                />
              </div>
              <Field
                label="Objective"
                value={programDraft.objective}
                onChange={(value) => setProgramDraft((draft) => ({ ...draft, objective: value }))}
              />
              <Textarea
                className="min-h-[320px] resize-none font-mono text-xs"
                value={programDraft.prompt}
                onChange={(event) =>
                  setProgramDraft((draft) => ({ ...draft, prompt: event.target.value }))
                }
              />
              <Button className="w-fit" onClick={() => void saveProgram()}>
                <Save className="size-4" />
                Save program
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mine" className="min-h-0">
          <div className="grid h-full min-h-0 gap-3 md:grid-cols-[minmax(0,1fr)_360px]">
            <ThreadTable
              rows={visibleThreads}
              selected={selectedThreadSet}
              onToggle={toggleThread}
            />
            <div className="grid content-start gap-3 rounded-md border bg-background p-3">
              <div>
                <h2 className="text-sm font-semibold">Dry-run mining</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Creates source-span-backed outputs, redaction reports, and reviewable verdict
                  gates under `.farplane/mine`.
                </p>
              </div>
              <Field label="Last days" value={lastDays} onChange={setLastDays} />
              <Field label="Source limit" value={sourceLimit} onChange={setSourceLimit} />
              <div className="grid gap-1">
                <Label className="text-xs">Program</Label>
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                  {selectedProgram?.name ?? "No program selected"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Metric
                  label="selected"
                  value={selectedThreadSet.size || Math.min(10, threads.length)}
                />
                <Metric label="privacy issues" value={runDetail?.run.privacyIssueCount ?? 0} />
              </div>
              <Button onClick={() => void startRun()} disabled={!selectedProgramId}>
                <Play className="size-4" />
                Run dry-run
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="min-h-0">
          <div className="grid h-full min-h-0 gap-3 md:grid-cols-[360px_minmax(0,1fr)]">
            <RunList
              rows={runs}
              selectedId={selectedRunId}
              onSelect={(runId) => void loadRun(runId)}
            />
            <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 rounded-md border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    {runDetail?.run.label ?? "No run selected"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {runDetail?.run.runId ?? "Create or select a run."}
                  </p>
                </div>
                {runDetail ? (
                  <Badge variant={runStatusTone(runDetail.run.status)}>
                    {runDetail.run.status}
                  </Badge>
                ) : null}
              </div>
              <div className="grid gap-2 md:grid-cols-7">
                <Metric label="sources" value={runDetail?.run.sourceCount ?? 0} />
                <Metric label="outputs" value={runDetail?.run.outputCount ?? 0} />
                <Metric label="reviewed" value={runDetail?.run.reviewedCount ?? 0} />
                <Metric label="promoted" value={runDetail?.run.promotedCount ?? 0} />
                <Metric label="rejected" value={runDetail?.run.rejectedCount ?? 0} />
                <Metric label="privacy" value={runDetail?.run.privacyIssueCount ?? 0} />
                <Metric label="duplicates" value={runDetail?.run.duplicateCount ?? 0} />
              </div>
              <div className="min-h-0">
                <Progress value={runProgress} />
                <pre className="mt-3 h-[calc(100%-20px)] overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
                  {runDetail?.reportMarkdown ?? "No report loaded."}
                </pre>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="outputs" className="min-h-0">
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <Input
              value={outputQuery}
              onChange={(event) => setOutputQuery(event.target.value)}
              placeholder="Filter outputs"
            />
            <OutputTable rows={visibleOutputs} onOpen={openOutput} />
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={isOutputOpen} onOpenChange={setIsOutputOpen}>
        <SheetContent className="w-[min(920px,92vw)] sm:max-w-none">
          <SheetHeader>
            <SheetTitle>{selectedOutput?.sourceTitle ?? "Output"}</SheetTitle>
            <SheetDescription>
              Mined output artifact for the selected source thread.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-wrap items-center gap-2 px-4">
            <Badge variant="outline">{selectedOutput?.verdict ?? "unreviewed"}</Badge>
            <Badge variant={selectedOutput?.redactionStatus === "clean" ? "secondary" : "outline"}>
              {selectedOutput?.redactionStatus ?? "unknown"}
            </Badge>
            <div className="ml-2 flex items-center gap-1 border-l pl-3">
              <Button
                size="sm"
                variant={outputViewMode === "markdown" ? "default" : "outline"}
                onClick={() => setOutputViewMode("markdown")}
              >
                Markdown
              </Button>
              <Button
                size="sm"
                variant={outputViewMode === "decisions" ? "default" : "outline"}
                onClick={() => setOutputViewMode("decisions")}
              >
                Decisions
              </Button>
              <Button
                size="sm"
                variant={outputViewMode === "evidence" ? "default" : "outline"}
                onClick={() => setOutputViewMode("evidence")}
              >
                Evidence
              </Button>
              <Button
                size="sm"
                variant={outputViewMode === "json" ? "default" : "outline"}
                onClick={() => setOutputViewMode("json")}
              >
                JSON
              </Button>
              <Button
                size="sm"
                variant={outputViewMode === "redaction" ? "default" : "outline"}
                onClick={() => setOutputViewMode("redaction")}
              >
                Redaction
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => void setOutputVerdict("unreviewed")}>
              <ListChecks className="size-4" />
              Unreview
            </Button>
            <Button size="sm" variant="outline" onClick={() => void setOutputVerdict("rejected")}>
              Reject
            </Button>
            <Button
              size="sm"
              variant={selectedOutput?.redactionStatus === "clean" ? "default" : "outline"}
              onClick={() => void setOutputVerdict("promoted")}
              disabled={selectedOutput?.redactionStatus !== "clean"}
            >
              Promote
            </Button>
          </div>
          <ScrollArea className="mt-2 h-[calc(100dvh-150px)] rounded-md border bg-muted/20 p-3">
            {outputViewMode === "markdown" ? (
              <pre className="whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere]">
                {selectedOutput?.outputMarkdown ?? "No output selected."}
              </pre>
            ) : null}
            {outputViewMode === "json" ? (
              <pre className="whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere]">
                {selectedOutputJsonText}
              </pre>
            ) : null}
            {outputViewMode === "decisions" ? (
              <pre className="whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere]">
                {selectedOutputDecisionsText}
              </pre>
            ) : null}
            {outputViewMode === "evidence" ? (
              <EvidenceList rows={selectedOutputEvidenceRows} />
            ) : null}
            {outputViewMode === "redaction" ? (
              <pre className="mt-4 whitespace-pre-wrap break-words border-t pt-4 text-xs [overflow-wrap:anywhere]">
                {selectedOutput?.redactionMarkdown ?? "No redaction report selected."}
              </pre>
            ) : null}
          </ScrollArea>
        </SheetContent>
      </Sheet>
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

function Metric({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold">{value}</p>
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

function occurrenceKey(base: string, counts: Map<string, number>): string {
  const nextCount = (counts.get(base) ?? 0) + 1;
  counts.set(base, nextCount);
  return nextCount === 1 ? base : `${base}:${nextCount}`;
}

function ProgramList({
  onSelect,
  rows,
  selectedId,
}: {
  onSelect: (id: string) => void;
  rows: ThreadDataProgram[];
  selectedId: string;
}): ReactElement {
  return (
    <div className="rounded-md border">
      <ScrollArea className="h-full max-h-[calc(100dvh-180px)]">
        {rows.map((program) => (
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
  );
}

function ThreadTable({
  onToggle,
  rows,
  selected,
}: {
  onToggle: (id: string) => void;
  rows: ThreadDataSource[];
  selected: Set<string>;
}): ReactElement {
  const keyCounts = new Map<string, number>();
  return (
    <div className="rounded-md border">
      <ScrollArea className="h-full max-h-[calc(100dvh-235px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]" />
              <TableHead>Thread</TableHead>
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
                <TableCell>
                  <Checkbox
                    checked={selected.has(thread.id)}
                    onCheckedChange={() => onToggle(thread.id)}
                  />
                </TableCell>
                <TableCell className="max-w-[520px]">
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

function RunList({
  onSelect,
  rows,
  selectedId,
}: {
  onSelect: (id: string) => void;
  rows: ThreadDataRunIndexEntry[];
  selectedId: string | null;
}): ReactElement {
  return (
    <div className="rounded-md border">
      <ScrollArea className="h-full max-h-[calc(100dvh-180px)]">
        {rows.map((run) => (
          <button
            key={run.runId}
            type="button"
            className={`block w-full border-b px-3 py-2 text-left hover:bg-muted/50 ${run.runId === selectedId ? "bg-muted" : ""}`}
            onClick={() => onSelect(run.runId)}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{run.label}</span>
              <Badge variant={runStatusTone(run.status)}>{run.status}</Badge>
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {formatMiningDate(run.createdAt)} | {run.outputCount}/{run.sourceCount} outputs
            </span>
          </button>
        ))}
      </ScrollArea>
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
      <ScrollArea className="h-full max-h-[calc(100dvh-220px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Session</TableHead>
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
                <TableCell className="max-w-[150px] truncate font-mono text-xs">
                  {output.sessionId}
                </TableCell>
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
