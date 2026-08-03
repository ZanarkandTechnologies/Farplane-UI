/**
 * Filesystem project-ticket owner for CLI reads and conservative writes.
 *
 * Inputs are an explicit project path plus canonical TASK-* identity. Outputs
 * are projections derived from ticket.md files. Writes preserve unknown YAML
 * and unrelated Markdown, and never expose delete or close operations.
 */
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type ProjectTicketStatus = "todo" | "in_progress" | "review" | "blocked" | "done";
export type WritableProjectTicketStatus = Exclude<ProjectTicketStatus, "done">;
export type ProjectTicketPriority = "low" | "medium" | "high";

export type ProjectTicket = {
  id: string;
  ticketId: string;
  title: string;
  status: string;
  owner: string;
  ownerAgentId: string;
  claimedBy: string;
  priority: string;
  notes: string;
  markdown: string;
  frontMatter: Record<string, string>;
  approvalState?: string;
  linkedSessionKey?: string;
  createdAt?: number;
  dueAt?: number;
  phase?: string;
  ready?: boolean;
  nextAction?: string;
  projectPath: string;
  filePath: string;
  artefactPath: string;
  updatedAt: number;
  metadataUpdatedAt: string;
};

export type ProjectTicketPatch = {
  title?: string;
  status?: WritableProjectTicketStatus;
  owner?: string;
  claimedBy?: string;
  priority?: ProjectTicketPriority;
};

export type ProjectTicketReadIssue = {
  ticketId: string;
  filePath: string;
  error: string;
};

export type ProjectTicketScan = {
  tickets: ProjectTicket[];
  issues: ProjectTicketReadIssue[];
};

export type FoundationStep = "find_customer" | "deliver_value" | "collect_revenue";

export type ProjectFoundationState = {
  mode: "legacy" | "locked" | "unlocked";
  activeTickets: ProjectTicket[];
  completedCount: 0 | 1 | 2 | 3;
  totalCount: 3;
};

const TICKET_ID_PATTERN = /^TASK-(\d{4,})$/;
const SCALAR_FIELD_PATTERN = /^([A-Za-z0-9_-]+):(?:[ \t]*(.*))?$/;
const FOUNDATION_STEPS = new Set<FoundationStep>([
  "find_customer",
  "deliver_value",
  "collect_revenue",
]);
const FOUNDATION_SEQUENCE_BY_STEP: Record<FoundationStep, number> = {
  find_customer: 1,
  deliver_value: 2,
  collect_revenue: 3,
};

function foundationStep(ticket: ProjectTicket): FoundationStep | null {
  const value = ticket.frontMatter.foundation_step?.trim();
  return FOUNDATION_STEPS.has(value as FoundationStep) ? (value as FoundationStep) : null;
}

function hasFoundationMarker(ticket: ProjectTicket): boolean {
  return Boolean(
    ticket.frontMatter.foundation_step?.trim() || ticket.frontMatter.foundation_sequence?.trim(),
  );
}

function foundationContractIssue(tickets: ProjectTicket[]): string | null {
  const seenSteps = new Set<FoundationStep>();
  const seenSequences = new Set<number>();
  for (const ticket of tickets) {
    const step = foundationStep(ticket);
    const sequence = Number.parseInt(ticket.frontMatter.foundation_sequence?.trim() ?? "", 10);
    if (!step || sequence !== FOUNDATION_SEQUENCE_BY_STEP[step]) {
      return `invalid_metadata:${ticket.ticketId}`;
    }
    if (seenSteps.has(step) || seenSequences.has(sequence)) {
      return `duplicate_metadata:${ticket.ticketId}`;
    }
    seenSteps.add(step);
    seenSequences.add(sequence);
  }
  return null;
}

export function deriveProjectFoundationState(
  tickets: ProjectTicket[],
): ProjectFoundationState {
  const markedTickets = tickets.filter(hasFoundationMarker);
  const activeTickets = markedTickets.filter((ticket) => ticket.status !== "done");
  const completedCount = Math.max(0, Math.min(3, 3 - activeTickets.length)) as 0 | 1 | 2 | 3;
  return {
    mode:
      activeTickets.length > 0 ? "locked" : markedTickets.length > 0 ? "unlocked" : "legacy",
    activeTickets,
    completedCount,
    totalCount: 3,
  };
}

export async function assertProjectFoundationUnlocked(
  projectPath: string | undefined,
  action: "create_ticket" | "activate_heartbeat" | "activate_autonomy",
): Promise<void> {
  if (!projectPath?.trim()) return;
  const scan = await scanProjectTickets(projectPath);
  for (const issue of scan.issues) {
    const raw = await readFile(issue.filePath, "utf-8").catch(() => "");
    if (/^foundation_(?:step|sequence):/m.test(raw)) {
      throw new Error(`foundation_gate_unreadable:${action}:${issue.ticketId}`);
    }
  }
  const state = deriveProjectFoundationState(scan.tickets);
  if (state.mode !== "locked") return;
  const contractIssue = foundationContractIssue(state.activeTickets);
  if (contractIssue) {
    throw new Error(`foundation_locked:${action}:${contractIssue}`);
  }
  const steps = state.activeTickets
    .map((ticket) => foundationStep(ticket) ?? "invalid")
    .join(",");
  throw new Error(`foundation_locked:${action}:${steps}`);
}

function requireProjectPath(projectPath: string): string {
  const trimmed = projectPath.trim();
  if (!trimmed || !path.isAbsolute(trimmed)) {
    throw new Error("invalid_project_path:absolute_path_required");
  }
  return path.resolve(trimmed);
}

export function normalizeTicketId(ticketId: string): string {
  const normalized = ticketId.trim().toUpperCase();
  if (!TICKET_ID_PATTERN.test(normalized)) {
    throw new Error(`invalid_ticket_id:${ticketId}`);
  }
  return normalized;
}

function ticketsRoot(projectPath: string): string {
  return path.join(requireProjectPath(projectPath), "tickets");
}

function ticketDirectory(projectPath: string, ticketId: string): string {
  const root = ticketsRoot(projectPath);
  const normalized = normalizeTicketId(ticketId);
  const candidate = path.join(root, normalized);
  if (path.dirname(candidate) !== root) throw new Error(`invalid_ticket_id:${ticketId}`);
  return candidate;
}

function splitTicketDocument(raw: string): {
  frontmatterLines: string[];
  body: string;
} {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) throw new Error("invalid_ticket_frontmatter");
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing < 0) throw new Error("invalid_ticket_frontmatter");
  return {
    frontmatterLines: normalized.slice(4, closing).split("\n"),
    body: normalized.slice(closing + 5),
  };
}

function decodeScalar(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readScalar(lines: string[], key: string): string {
  for (const line of lines) {
    const match = line.match(SCALAR_FIELD_PATTERN);
    if (match?.[1] === key) return decodeScalar(match[2]);
  }
  return "";
}

function readFrontMatter(lines: string[]): Record<string, string> {
  const frontMatter: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(SCALAR_FIELD_PATTERN);
    if (match?.[1]) frontMatter[match[1]] = decodeScalar(match[2]);
  }
  return frontMatter;
}

function encodeScalar(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    /^[A-Za-z0-9_./@+-]+(?: [A-Za-z0-9_./@+-]+)*$/.test(trimmed) &&
    !/^(?:true|false|null|yes|no|on|off|\d+(?:\.\d+)?)$/i.test(trimmed)
  ) {
    return trimmed;
  }
  return JSON.stringify(trimmed);
}

function patchScalar(lines: string[], key: string, value: string): string[] {
  const replacement = `${key}: ${encodeScalar(value)}`.trimEnd();
  const index = lines.findIndex((line) => line.match(SCALAR_FIELD_PATTERN)?.[1] === key);
  if (index >= 0) {
    const next = [...lines];
    next[index] = replacement;
    return next;
  }
  return [...lines, replacement];
}

function readNotes(body: string): string {
  const match = body.match(/(?:^|\n)## Notes[ \t]*\n([\s\S]*?)(?=\n## [^\n]+(?:\n|$)|$)/);
  return match?.[1]?.replace(/\s+$/, "") ?? "";
}

function writeNotes(body: string, notes: string): string {
  const cleanNotes = notes.replace(/\r\n/g, "\n").trim();
  const section = `## Notes\n${cleanNotes}${cleanNotes ? "\n" : ""}`;
  const pattern = /(^|\n)## Notes[ \t]*\n[\s\S]*?(?=\n## [^\n]+(?:\n|$)|$)/;
  if (pattern.test(body)) {
    return body.replace(pattern, (_match, prefix: string) => `${prefix}${section}`);
  }
  const trimmed = body.replace(/\s+$/, "");
  return `${trimmed}${trimmed ? "\n\n" : ""}${section}`;
}

function ticketTimestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function deriveTicketStatus(frontmatterLines: string[]): ProjectTicketStatus {
  const lifecycleStatus = readScalar(frontmatterLines, "status").toLowerCase();
  const phase = readScalar(frontmatterLines, "phase").toLowerCase();
  if (
    ["done", "complete", "completed", "closed", "verified", "archived"].includes(lifecycleStatus)
  ) {
    return "done";
  }
  if (lifecycleStatus === "todo") return "todo";
  if (lifecycleStatus === "blocked") return "blocked";
  if (lifecycleStatus === "review" || phase === "review" || phase === "verification")
    return "review";
  if (phase === "planning" || phase === "backlog") return "todo";
  return "in_progress";
}

function lifecycleFields(status: WritableProjectTicketStatus): {
  phase?: string;
  status: string;
} {
  if (status === "todo") return { phase: "planning", status: "active" };
  if (status === "in_progress") return { phase: "implementation", status: "active" };
  if (status === "review") return { phase: "review", status: "review" };
  return { status: "blocked" };
}

async function projectTicketFromRaw(
  projectPath: string,
  filePath: string,
  raw: string,
): Promise<ProjectTicket> {
  const { frontmatterLines, body } = splitTicketDocument(raw);
  const frontMatter = readFrontMatter(frontmatterLines);
  const directoryId = path.basename(path.dirname(filePath));
  const ticketId = normalizeTicketId(readScalar(frontmatterLines, "ticket_id"));
  if (ticketId !== directoryId) {
    throw new Error(`ticket_identity_mismatch:${directoryId}:${ticketId}`);
  }
  const resolvedProjectPath = requireProjectPath(projectPath);
  const status = deriveTicketStatus(frontmatterLines);
  const owner = readScalar(frontmatterLines, "owner");
  const claimedBy = readScalar(frontmatterLines, "claimed_by");
  const fileStat = await stat(filePath);
  return {
    id: ticketId,
    ticketId,
    title: readScalar(frontmatterLines, "title"),
    status,
    owner,
    ownerAgentId: claimedBy || owner,
    claimedBy,
    priority: readScalar(frontmatterLines, "priority") || "medium",
    notes: readNotes(body),
    markdown: raw,
    frontMatter,
    approvalState:
      readScalar(frontmatterLines, "approval_state") ||
      (status === "review" ? "pending_review" : status === "done" ? "executed" : undefined),
    linkedSessionKey:
      readScalar(frontmatterLines, "linked_session_key") ||
      readScalar(frontmatterLines, "session_key") ||
      readScalar(frontmatterLines, "thread_id") ||
      undefined,
    createdAt: ticketTimestamp(readScalar(frontmatterLines, "created_at")),
    dueAt: ticketTimestamp(readScalar(frontmatterLines, "due_at")),
    phase: readScalar(frontmatterLines, "phase") || undefined,
    ready:
      readScalar(frontmatterLines, "ready") === "true"
        ? true
        : readScalar(frontmatterLines, "ready") === "false"
          ? false
          : undefined,
    nextAction: readScalar(frontmatterLines, "next_action") || undefined,
    projectPath: resolvedProjectPath,
    filePath,
    artefactPath: path.relative(resolvedProjectPath, filePath).replace(/\\/g, "/"),
    updatedAt: fileStat.mtimeMs,
    metadataUpdatedAt: readScalar(frontmatterLines, "updated_at"),
  };
}

export async function readProjectTicket(
  projectPath: string,
  ticketId: string,
): Promise<ProjectTicket> {
  const directory = ticketDirectory(projectPath, ticketId);
  const filePath = path.join(directory, "ticket.md");
  try {
    return await projectTicketFromRaw(projectPath, filePath, await readFile(filePath, "utf-8"));
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new Error(`ticket_not_found:${normalizeTicketId(ticketId)}`);
    }
    throw error;
  }
}

export async function listProjectTickets(projectPath: string): Promise<ProjectTicket[]> {
  const scan = await scanProjectTickets(projectPath);
  if (scan.issues[0]) throw new Error(scan.issues[0].error);
  return scan.tickets;
}

/**
 * Read all independently valid tickets without letting a partial editor save
 * make sibling tickets or the UI's polling route unavailable.
 */
export async function scanProjectTickets(projectPath: string): Promise<ProjectTicketScan> {
  const root = ticketsRoot(projectPath);
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return { tickets: [], issues: [] };
    throw error;
  }
  const ids = entries
    .filter((entry) => entry.isDirectory() && TICKET_ID_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const tickets: ProjectTicket[] = [];
  const issues: ProjectTicketReadIssue[] = [];
  for (const ticketId of ids) {
    try {
      tickets.push(await readProjectTicket(projectPath, ticketId));
    } catch (error) {
      issues.push({
        ticketId,
        filePath: path.join(root, ticketId, "ticket.md"),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { tickets, issues };
}

async function nextTicketNumber(projectPath: string): Promise<number> {
  const root = ticketsRoot(projectPath);
  let highest = 0;
  for (const directory of [root, path.join(root, "archive")]) {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const match = entry.name.match(TICKET_ID_PATTERN);
      if (match) highest = Math.max(highest, Number.parseInt(match[1], 10));
    }
  }
  return highest + 1;
}

function initialTicketDocument(input: {
  ticketId: string;
  title: string;
  status: WritableProjectTicketStatus;
  owner: string;
  claimedBy: string;
  priority: ProjectTicketPriority;
  notes: string;
  now: string;
}): string {
  const lifecycle = lifecycleFields(input.status);
  return [
    "---",
    "template_id: ticket-template",
    'template_version: "0.1.3"',
    `ticket_id: ${input.ticketId}`,
    `title: ${encodeScalar(input.title)}`,
    `phase: ${lifecycle.phase ?? "implementation"}`,
    `status: ${lifecycle.status}`,
    `owner: ${encodeScalar(input.owner)}`,
    `claimed_by: ${encodeScalar(input.claimedBy)}`,
    `priority: ${input.priority}`,
    "depends_on: []",
    "blocked_by: []",
    "ready: true",
    "approval_required: false",
    "requires_qa: true",
    "requires_demo: false",
    `created_at: ${input.now}`,
    `updated_at: ${input.now}`,
    "next_action: define the next concrete step",
    "last_verification: none",
    "---",
    "",
    `# ${input.ticketId}: ${input.title}`,
    "",
    "## Summary",
    "",
    "Define the requested outcome and why it matters.",
    "",
    "## Notes",
    input.notes,
    "",
  ].join("\n");
}

export async function createProjectTicket(input: {
  projectPath: string;
  title: string;
  status?: WritableProjectTicketStatus;
  owner?: string;
  claimedBy?: string;
  priority?: ProjectTicketPriority;
  notes?: string;
  ticketId?: string;
}): Promise<ProjectTicket> {
  const projectPath = requireProjectPath(input.projectPath);
  const title = input.title.trim();
  if (!title) throw new Error("invalid_ticket_title");
  await assertProjectFoundationUnlocked(projectPath, "create_ticket");
  const root = ticketsRoot(projectPath);
  await mkdir(root, { recursive: true });
  if (input.ticketId) {
    const explicitId = normalizeTicketId(input.ticketId);
    const archivedPath = path.join(root, "archive", explicitId);
    const archivedExists = await stat(archivedPath)
      .then(() => true)
      .catch(() => false);
    if (archivedExists) throw new Error(`ticket_id_already_used:${explicitId}`);
  }
  let nextNumber = await nextTicketNumber(projectPath);
  for (;;) {
    const ticketId = input.ticketId
      ? normalizeTicketId(input.ticketId)
      : `TASK-${String(nextNumber).padStart(4, "0")}`;
    const directory = ticketDirectory(projectPath, ticketId);
    try {
      await mkdir(directory);
      const now = new Date().toISOString();
      await writeFile(
        path.join(directory, "ticket.md"),
        initialTicketDocument({
          ticketId,
          title,
          status: input.status ?? "todo",
          owner: input.owner?.trim() || "unassigned",
          claimedBy: input.claimedBy?.trim() || "",
          priority: input.priority ?? "medium",
          notes: input.notes?.trim() || "",
          now,
        }),
        { encoding: "utf-8", flag: "wx" },
      );
      return readProjectTicket(projectPath, ticketId);
    } catch (error) {
      if ((error as { code?: string }).code !== "EEXIST" || input.ticketId) throw error;
      nextNumber += 1;
    }
  }
}

export async function updateProjectTicket(
  projectPath: string,
  ticketId: string,
  patch: ProjectTicketPatch,
): Promise<ProjectTicket> {
  const existing = await readProjectTicket(projectPath, ticketId);
  const before = await stat(existing.filePath);
  const raw = await readFile(existing.filePath, "utf-8");
  const { frontmatterLines, body } = splitTicketDocument(raw);
  let lines = frontmatterLines;
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new Error("invalid_ticket_title");
    lines = patchScalar(lines, "title", patch.title);
  }
  if (patch.status !== undefined) {
    const lifecycle = lifecycleFields(patch.status);
    lines = patchScalar(lines, "status", lifecycle.status);
    if (lifecycle.phase) lines = patchScalar(lines, "phase", lifecycle.phase);
  }
  if (patch.owner !== undefined) lines = patchScalar(lines, "owner", patch.owner);
  if (patch.claimedBy !== undefined) lines = patchScalar(lines, "claimed_by", patch.claimedBy);
  if (patch.priority !== undefined) lines = patchScalar(lines, "priority", patch.priority);
  lines = patchScalar(lines, "updated_at", new Date().toISOString());
  let nextBody = body;
  if (patch.title !== undefined) {
    const heading = new RegExp(`^# ${existing.ticketId.replace("-", "\\-")}:.*$`, "m");
    nextBody = nextBody.replace(heading, `# ${existing.ticketId}: ${patch.title.trim()}`);
  }
  const afterRead = await stat(existing.filePath);
  if (afterRead.mtimeMs !== before.mtimeMs || afterRead.size !== before.size) {
    throw new Error(`ticket_changed_during_update:${existing.ticketId}`);
  }
  await atomicReplace(existing.filePath, `---\n${lines.join("\n")}\n---\n${nextBody}`);
  return readProjectTicket(projectPath, existing.ticketId);
}

export async function setProjectTicketNotes(
  projectPath: string,
  ticketId: string,
  notes: string,
): Promise<ProjectTicket> {
  const existing = await readProjectTicket(projectPath, ticketId);
  const before = await stat(existing.filePath);
  const raw = await readFile(existing.filePath, "utf-8");
  const { frontmatterLines, body } = splitTicketDocument(raw);
  const nextLines = patchScalar(frontmatterLines, "updated_at", new Date().toISOString());
  const afterRead = await stat(existing.filePath);
  if (afterRead.mtimeMs !== before.mtimeMs || afterRead.size !== before.size) {
    throw new Error(`ticket_changed_during_update:${existing.ticketId}`);
  }
  await atomicReplace(
    existing.filePath,
    `---\n${nextLines.join("\n")}\n---\n${writeNotes(body, notes)}`,
  );
  return readProjectTicket(projectPath, existing.ticketId);
}

async function atomicReplace(filePath: string, content: string): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, content, { encoding: "utf-8", flag: "wx" });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function appendProjectTicketNotes(
  projectPath: string,
  ticketId: string,
  notes: string,
): Promise<ProjectTicket> {
  const chunk = notes.trim();
  if (!chunk) throw new Error("invalid_memory_text");
  const existing = await readProjectTicket(projectPath, ticketId);
  const combined = existing.notes.trim() ? `${existing.notes.trim()}\n\n${chunk}` : chunk;
  return setProjectTicketNotes(projectPath, existing.ticketId, combined);
}
