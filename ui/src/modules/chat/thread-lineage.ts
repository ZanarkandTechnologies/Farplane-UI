/**
 * CHAT THREAD LINEAGE
 * ===================
 * Ownership: chat module.
 * Inputs: runtime session rows plus compact thread-lineage telemetry edges.
 * Outputs: root conversation rows and nested delegated conversation rows.
 * Side effects: none.
 * Invariants: stores references only; transcripts remain owned by the runtime.
 */

export type ChatThreadRow = {
  _id: string;
  title?: string;
  parentThreadId?: string;
  agentId?: string;
  sessionKey?: string;
  isPendingNew?: boolean;
};

export type ChatThreadLineageEdge = {
  source: string;
  target: string;
  kind: "created" | "forked";
  eventAt?: number;
  title?: string;
};

export type OrganizedChatThreads = {
  threads: ChatThreadRow[];
  subthreadsMap: Record<string, ChatThreadRow[]>;
  allThreads: ChatThreadRow[];
};

const CODEX_THREAD_PREFIX = "codex-thread:";
const PENDING_THREAD_PREFIX = "pending:";

function cleanThreadId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function codexSessionKeyFromThreadId(value: string): string {
  const id = cleanThreadId(value);
  if (!id || id.startsWith(CODEX_THREAD_PREFIX) || id.startsWith(PENDING_THREAD_PREFIX)) return id;
  return `${CODEX_THREAD_PREFIX}${id}`;
}

function normalizeParentThreadId(value: string | undefined): string {
  const id = cleanThreadId(value);
  return id ? codexSessionKeyFromThreadId(id) : "";
}

function isPendingThreadId(value: string): boolean {
  return value.startsWith(PENDING_THREAD_PREFIX);
}

function upsertSubthread(
  subthreadsMap: Map<string, Map<string, ChatThreadRow>>,
  parentId: string,
  child: ChatThreadRow,
): void {
  const children = subthreadsMap.get(parentId) ?? new Map<string, ChatThreadRow>();
  const current = children.get(child._id);
  children.set(child._id, {
    ...current,
    ...child,
    title: child.title ?? current?.title,
  });
  subthreadsMap.set(parentId, children);
}

function childTitleFromEdge(edge: ChatThreadLineageEdge): string {
  if (edge.title?.trim()) return edge.title.trim();
  return edge.kind === "forked" ? "Forked thread" : "Created thread";
}

export function organizeChatThreadsByLineage(input: {
  threads: ChatThreadRow[];
  lineageEdges?: ChatThreadLineageEdge[];
  selectedAgentId?: string | null;
}): OrganizedChatThreads {
  const byId = new Map<string, ChatThreadRow>();
  const rootIds = new Set<string>();
  const subthreads = new Map<string, Map<string, ChatThreadRow>>();

  for (const thread of input.threads) {
    if (!thread._id.trim()) continue;
    byId.set(thread._id, thread);
    rootIds.add(thread._id);
  }

  for (const thread of input.threads) {
    const parentId = normalizeParentThreadId(thread.parentThreadId);
    if (!parentId || parentId === thread._id || !byId.has(parentId)) continue;
    rootIds.delete(thread._id);
    upsertSubthread(subthreads, parentId, {
      ...thread,
      parentThreadId: parentId,
    });
  }

  for (const edge of input.lineageEdges ?? []) {
    const parentId = codexSessionKeyFromThreadId(edge.source);
    const childId = codexSessionKeyFromThreadId(edge.target);
    if (!parentId || !childId || parentId === childId || isPendingThreadId(childId)) continue;
    if (!byId.has(parentId)) continue;

    const existing = byId.get(childId);
    const child: ChatThreadRow = {
      _id: childId,
      title: existing?.title ?? childTitleFromEdge(edge),
      parentThreadId: parentId,
      agentId: existing?.agentId ?? input.selectedAgentId ?? undefined,
      sessionKey: existing?.sessionKey ?? childId,
      isPendingNew: existing?.isPendingNew,
    };
    byId.set(childId, child);
    rootIds.delete(childId);
    upsertSubthread(subthreads, parentId, child);
  }

  const subthreadsMap = Object.fromEntries(
    [...subthreads.entries()].map(([parentId, children]) => [parentId, [...children.values()]]),
  );
  const rootThreads = input.threads.filter((thread) => rootIds.has(thread._id));
  const nestedThreads = Object.values(subthreadsMap).flat();
  return {
    threads: rootThreads,
    subthreadsMap,
    allThreads: [...rootThreads, ...nestedThreads],
  };
}

export function chatThreadListContains(
  threads: ChatThreadRow[],
  threadId: string | null | undefined,
): boolean {
  if (!threadId) return false;
  return threads.some((thread) => thread._id === threadId);
}
