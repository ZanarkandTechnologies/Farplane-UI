import { CalendarDays, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { hasCoordinates } from "../lib/world-projection";
import type { WorldEdge, WorldNode, WorldSelection, WorldTimelineEntry } from "../types";

type WorldEntityDetailProps = {
  edges: WorldEdge[];
  nodes: WorldNode[];
  timeline: WorldTimelineEntry[];
  selection: WorldSelection;
  onSelect: (selection: WorldSelection) => void;
};

function readableTag(value: string): string {
  return value.replaceAll("-", " ");
}

function readableContext(value: string): string {
  return value.replace(/\[[a-z][a-z0-9-]*:[^\]]+\]\s*/g, "").trim();
}

function taggedValues(entries: WorldTimelineEntry[]): string[] {
  const values: string[] = [];
  for (const entry of entries) {
    for (const [key, entries] of Object.entries(entry.tags)) {
      for (const value of entries) {
        const label = `${readableTag(key)}: ${readableTag(value)}`;
        if (!values.includes(label)) values.push(label);
      }
    }
  }
  return values;
}

export function WorldEntityDetail(props: WorldEntityDetailProps): React.JSX.Element {
  const nodeByKey = new Map(props.nodes.map((node) => [node.key, node]));
  if (!props.selection) {
    return (
      <div className="flex h-full items-center justify-center px-5 text-center text-xs text-muted-foreground">
        Select an entity or association to inspect its evidence and timeline.
      </div>
    );
  }
  if (props.selection.type === "edge") {
    const edge = props.edges.find((candidate) => candidate.key === props.selection?.key);
    if (!edge) {
      return (
        <div className="p-4 text-xs text-muted-foreground">
          Association is outside the current filter.
        </div>
      );
    }
    const source = nodeByKey.get(edge.sourceKey);
    const target = nodeByKey.get(edge.targetKey);
    return (
      <div className="space-y-4 p-4">
        <div>
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            Association
          </div>
          <div className="mt-2 text-sm font-semibold">
            {source?.name ?? edge.sourceEntityId} ↔ {target?.name ?? edge.targetEntityId}
          </div>
        </div>
        <blockquote className="border-l-2 border-sky-400 bg-muted/40 px-3 py-2 text-sm leading-6">
          {readableContext(edge.displayContext)}
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
  const timeline = props.timeline.filter(
    (entry) =>
      entry.entityKeys.includes(node.key) ||
      (entry.projectId === node.projectId && entry.entityIds.includes(node.entityId)),
  );
  const tags = taggedValues(timeline);

  return (
    <div className="space-y-5 p-4" data-testid="world-entity-detail">
      <div>
        <Badge variant="secondary" className="mb-2 capitalize">
          {node.kind}
        </Badge>
        <h3 className="text-base font-semibold">{node.name}</h3>
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{node.entityId}</div>
      </div>

      {tags.length ? (
        <section aria-labelledby="world-tags-heading">
          <div
            id="world-tags-heading"
            className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground"
          >
            <Tags aria-hidden="true" className="size-3" /> Timeline tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal text-muted-foreground">
                {tag}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      <dl className="grid grid-cols-[70px_1fr] gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Location</dt>
        <dd>{node.location || "Unlocated"}</dd>
        <dt className="text-muted-foreground">Position</dt>
        <dd>{hasCoordinates(node) ? `${node.latitude}, ${node.longitude}` : "Not plotted"}</dd>
      </dl>

      <section aria-labelledby="world-timeline-heading">
        <div
          id="world-timeline-heading"
          className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground"
        >
          <CalendarDays aria-hidden="true" className="size-3" /> Timeline
        </div>
        {timeline.length ? (
          <ol className="space-y-3 border-l border-border pl-3">
            {timeline.map((entry) => (
              <li key={entry.key} className="relative">
                <span className="absolute -left-[16.5px] top-1.5 size-1.5 rounded-full bg-sky-400" />
                <div className="flex flex-wrap items-center gap-1.5">
                  <time className="font-mono text-[10px] text-muted-foreground">{entry.date}</time>
                  {Object.entries(entry.tags).flatMap(([key, values]) =>
                    values.map((value) => (
                      <Badge key={`${key}:${value}`} variant="outline" className="h-5 font-normal">
                        {readableTag(key)}: {readableTag(value)}
                      </Badge>
                    )),
                  )}
                </div>
                <p className="mt-1 text-xs leading-5">{entry.displayContext}</p>
                {entry.sourceEntityId !== node.entityId ? (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    From{" "}
                    {props.nodes.find(
                      (candidate) =>
                        candidate.projectId === entry.projectId &&
                        candidate.entityId === entry.sourceEntityId,
                    )?.name ?? entry.sourceEntityId}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="text-xs text-muted-foreground">No dated timeline evidence.</div>
        )}
      </section>

      <section aria-labelledby="world-connected-heading">
        <div
          id="world-connected-heading"
          className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground"
        >
          Connected
        </div>
        {connected.length ? (
          <div className="space-y-1.5">
            {connected.map((edge) => (
              <button
                key={edge.key}
                type="button"
                onClick={() => props.onSelect({ type: "edge", key: edge.key })}
                className="w-full rounded-md border px-2.5 py-2 text-left text-xs hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
              >
                <div className="line-clamp-2 leading-5">{readableContext(edge.displayContext)}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No explicit associations.</div>
        )}
      </section>

      {node.sourcePath ? (
        <div className="break-all border-t pt-3 font-mono text-[11px] text-muted-foreground">
          {node.sourcePath}
        </div>
      ) : null}
    </div>
  );
}
