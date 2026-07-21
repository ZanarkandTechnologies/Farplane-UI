import { AlertTriangle, Globe2, LocateOff, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";
import { useWorldProjection } from "../hooks/use-world-projection";
import { filterWorldEdges, filterWorldNodes, hasCoordinates } from "../lib/world-projection";
import type { WorldEdge, WorldNode, WorldSelection } from "../types";
import { WorldMapCanvas } from "./world-map-canvas";

type WorldMapPanelProps = { open: boolean; onOpenChange: (open: boolean) => void };

function DetailPanel(props: {
  edges: WorldEdge[];
  nodes: WorldNode[];
  selection: WorldSelection;
  onSelect: (selection: WorldSelection) => void;
}): React.JSX.Element {
  const nodeByKey = new Map(props.nodes.map((node) => [node.key, node]));
  if (!props.selection) {
    return (
      <div className="flex h-full items-center justify-center px-5 text-center text-xs text-muted-foreground">
        Select an entity or association to inspect its source context.
      </div>
    );
  }
  if (props.selection.type === "edge") {
    const edge = props.edges.find((candidate) => candidate.key === props.selection?.key);
    if (!edge)
      return (
        <div className="p-4 text-xs text-muted-foreground">
          Association is outside the current filter.
        </div>
      );
    const source = nodeByKey.get(edge.sourceKey);
    const target = nodeByKey.get(edge.targetKey);
    return (
      <div className="space-y-4 p-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Association
          </div>
          <div className="mt-2 text-sm font-semibold">
            {source?.name ?? edge.sourceEntityId} ↔ {target?.name ?? edge.targetEntityId}
          </div>
        </div>
        <blockquote className="border-l-2 border-sky-400 bg-muted/40 px-3 py-2 text-sm leading-6">
          {edge.displayContext}
        </blockquote>
        {edge.section ? (
          <div className="text-xs text-muted-foreground">Section: {edge.section}</div>
        ) : null}
        {edge.sourcePath ? (
          <div className="break-all font-mono text-[11px] text-muted-foreground">
            {edge.sourcePath}
          </div>
        ) : null}
      </div>
    );
  }
  const node = props.nodes.find((candidate) => candidate.key === props.selection?.key);
  if (!node)
    return (
      <div className="p-4 text-xs text-muted-foreground">Entity is outside the current filter.</div>
    );
  const connected = props.edges.filter(
    (edge) => edge.sourceKey === node.key || edge.targetKey === node.key,
  );
  return (
    <div className="space-y-4 p-4">
      <div>
        <Badge variant="secondary" className="mb-2 capitalize">
          {node.kind}
        </Badge>
        <h3 className="text-base font-semibold">{node.name}</h3>
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{node.entityId}</div>
      </div>
      <dl className="grid grid-cols-[70px_1fr] gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Location</dt>
        <dd>{node.location || "Unlocated"}</dd>
        <dt className="text-muted-foreground">Position</dt>
        <dd>{hasCoordinates(node) ? `${node.latitude}, ${node.longitude}` : "Not plotted"}</dd>
      </dl>
      {connected.length ? (
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Connected
          </div>
          <div className="space-y-1.5">
            {connected.map((edge) => (
              <button
                key={edge.key}
                type="button"
                onClick={() => props.onSelect({ type: "edge", key: edge.key })}
                className="w-full rounded-md border px-2.5 py-2 text-left text-xs hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
              >
                <div className="line-clamp-2 leading-5">{edge.displayContext}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No explicit associations.</div>
      )}
      {node.sourcePath ? (
        <div className="break-all border-t pt-3 font-mono text-[11px] text-muted-foreground">
          {node.sourcePath}
        </div>
      ) : null}
    </div>
  );
}

export function WorldMapPanel({ open, onOpenChange }: WorldMapPanelProps): React.JSX.Element {
  const { companyModel } = useOfficeDataContext();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [location, setLocation] = useState("");
  const [viewId, setViewId] = useState("all");
  const [selection, setSelection] = useState<WorldSelection>(null);
  const projects = useMemo(
    () =>
      (companyModel?.projects ?? []).filter((project) =>
        project.trackingContext?.trim().startsWith("/"),
      ),
    [companyModel?.projects],
  );
  const project = projects.find((candidate) => candidate.id === selectedProjectId) ?? projects[0];
  const world = useWorldProjection(project?.trackingContext, open);
  const projection = world.data?.projection ?? null;

  useEffect(() => {
    if (open && !selectedProjectId && projects[0]) setSelectedProjectId(projects[0].id);
  }, [open, projects, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    setSelection(null);
    setViewId("all");
  }, [project?.id]);

  useEffect(() => {
    if (
      projection &&
      viewId !== "all" &&
      !projection.views.some((view) => view.id === viewId)
    ) {
      setSelection(null);
      setViewId("all");
    }
  }, [projection, viewId]);

  const filteredNodes = useMemo(
    () =>
      projection
        ? filterWorldNodes(projection.nodes, { query, kind, location, viewId }, projection.views)
        : [],
    [kind, location, projection, query, viewId],
  );
  const filteredEdges = useMemo(
    () => (projection ? filterWorldEdges(projection.edges, filteredNodes) : []),
    [filteredNodes, projection],
  );
  const kinds = useMemo(
    () => [...new Set((projection?.nodes ?? []).map((node) => node.kind))].sort(),
    [projection?.nodes],
  );
  const plottedCount = filteredNodes.filter(hasCoordinates).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[1000] flex h-[calc(100dvh-1rem)] min-h-0 max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden overscroll-contain border bg-background p-0 sm:h-[min(94vh,940px)] sm:max-w-[1560px]"
        data-testid="world-map-panel"
      >
        <DialogHeader className="border-b px-4 py-3 pr-12">
          <div className="flex flex-wrap items-center gap-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Globe2 aria-hidden="true" className="size-4 text-sky-400" />
              World
            </DialogTitle>
            <Select
              value={project?.id ?? ""}
              onValueChange={(value) => {
                setSelection(null);
                setSelectedProjectId(value);
              }}
            >
              <SelectTrigger aria-label="Select project" size="sm" className="min-w-44">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projection?.views.length ? (
              <Select
                value={viewId}
                onValueChange={(value) => {
                  setSelection(null);
                  setViewId(value);
                }}
              >
                <SelectTrigger aria-label="Select entity view" size="sm" className="min-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {projection.views.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {projection ? (
              <div
                aria-live="polite"
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span>{filteredNodes.length} entities</span>
                <span>·</span>
                <span>{plottedCount} plotted</span>
                <span>·</span>
                <span>{filteredEdges.length} associations</span>
              </div>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => void world.refetch()}
              disabled={!project || world.isFetching}
              aria-label="Refresh world projection"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${world.isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </DialogHeader>

        {!projects.length ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <Globe2 aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
              <div className="mt-3 text-sm font-medium">No project selected</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Add a project path to the Command Center to load its world projection.
              </div>
            </div>
          </div>
        ) : world.isLoading ? (
          <div
            role="status"
            className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
          >
            <RefreshCw aria-hidden="true" className="mr-2 size-4 animate-spin" />
            Loading world projection…
          </div>
        ) : world.isError ? (
          <div role="alert" className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <AlertTriangle aria-hidden="true" className="mx-auto size-8 text-destructive" />
              <div className="mt-3 text-sm font-medium">World projection unavailable</div>
              <div className="mt-1 max-w-lg text-xs text-muted-foreground">
                {world.error.message}
              </div>
              <Button
                className="mt-4"
                size="sm"
                variant="outline"
                onClick={() => void world.refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : world.data?.state === "missing" || !projection ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <LocateOff aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
              <div className="mt-3 text-sm font-medium">No world data yet</div>
              <div className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                Capture useful research with ingest-world-data, then compile project entities.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {projection.stale || projection.issues.length > 0 ? (
              <div
                role="status"
                className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200"
              >
                <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
                <span>
                  {projection.stale ? "Projection is marked stale. " : ""}
                  {projection.issues.length
                    ? `${projection.issues.length} compilation issue${projection.issues.length === 1 ? "" : "s"}.`
                    : ""}
                </span>
              </div>
            ) : null}
            <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(112px,0.5fr)_minmax(220px,1.5fr)_minmax(112px,0.5fr)] sm:grid-rows-[minmax(140px,0.65fr)_minmax(280px,1.35fr)_minmax(140px,0.65fr)] lg:grid-cols-[260px_minmax(0,1fr)_300px] lg:grid-rows-1">
              <aside className="flex min-h-0 flex-col border-b bg-muted/15 lg:border-r lg:border-b-0">
                <div className="space-y-2 border-b p-3">
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground"
                    />
                    <Input
                      aria-label="Search entities"
                      name="world-search"
                      autoComplete="off"
                      value={query}
                      onChange={(event) => {
                        setSelection(null);
                        setQuery(event.target.value);
                      }}
                      placeholder="Search entities…"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={kind}
                      onValueChange={(value) => {
                        setSelection(null);
                        setKind(value);
                      }}
                    >
                      <SelectTrigger
                        aria-label="Filter by entity kind"
                        size="sm"
                        className="w-full text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All kinds</SelectItem>
                        {kinds.map((item) => (
                          <SelectItem key={item} value={item} className="capitalize">
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      aria-label="Filter by location"
                      name="world-location"
                      autoComplete="off"
                      value={location}
                      onChange={(event) => {
                        setSelection(null);
                        setLocation(event.target.value);
                      }}
                      placeholder="Location…"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div
                  className="min-h-0 flex-1 overflow-y-auto p-2"
                  data-testid="world-node-results"
                >
                  {filteredNodes.length ? (
                    filteredNodes.map((node) => (
                      <button
                        key={node.key}
                        type="button"
                        onClick={() => setSelection({ type: "node", key: node.key })}
                        className={`mb-1 w-full rounded-md border px-2.5 py-2 text-left [content-visibility:auto] focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none ${selection?.type === "node" && selection.key === node.key ? "border-sky-400/60 bg-sky-400/10" : "border-transparent hover:bg-muted"}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-medium">{node.name}</span>
                          {!hasCoordinates(node) ? (
                            <LocateOff
                              aria-hidden="true"
                              className="ml-auto size-3 text-muted-foreground"
                            />
                          ) : null}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] capitalize text-muted-foreground">
                          {node.kind}
                          {node.location ? ` · ${node.location}` : " · Unlocated"}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No entities match these filters.
                    </div>
                  )}
                </div>
              </aside>
              <main className="min-h-0 p-3">
                <WorldMapCanvas
                  nodes={filteredNodes}
                  edges={filteredEdges}
                  onSelect={setSelection}
                />
              </main>
              <aside className="min-h-0 overflow-y-auto border-t bg-card/40 lg:border-t-0 lg:border-l">
                <DetailPanel
                  nodes={projection.nodes}
                  edges={projection.edges}
                  selection={selection}
                  onSelect={setSelection}
                />
              </aside>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
