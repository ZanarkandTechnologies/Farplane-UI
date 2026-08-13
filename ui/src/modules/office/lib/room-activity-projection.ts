/**
 * ROOM ACTIVITY PROJECTION
 * ========================
 * Ownership: Office3D presentation-only work activity.
 * Inputs: in-progress tickets, recent skill telemetry, project tracking contexts, and the room catalog.
 * Outputs: capped specialist workers plus ambient room signals; side effects: none.
 * Invariants: tickets choose worker placement, telemetry only enriches it, private paths never become labels, and links are explicit.
 */

import { resolveTicketSpecialist } from "@/lib/ticket-routing/specialist-registry";

export const ROOM_ACTIVITY_PRESENTATION_FRESHNESS_MS = 5 * 60 * 1_000;
export const ROOM_ACTIVITY_VISIBLE_LIMIT = 3;

export type RoomActivityCatalogEntry = {
  id: string;
  activitySkillIds: readonly string[];
};

export type RoomActivityInvocation = {
  skillId: string;
  sessionId?: string;
  projectPath?: string;
  occurredAt: number;
};

export type RoomActivityProject = {
  id: string;
  name: string;
  trackingContext?: string;
};

export type RoomActivityCallerTarget =
  | { kind: "project"; projectId: string }
  | { kind: "session"; sessionKey: string };

export type RoomActivity = {
  id: string;
  roomId: string;
  projectId?: string;
  projectLabel: string;
  sessionId?: string;
  skillId: string;
  state: "active";
  startedAt: number;
  updatedAt: number;
  callerTarget?: RoomActivityCallerTarget;
  source?: "telemetry" | "ticket";
  ticketId?: string;
  ticketTitle?: string;
  specialistId?: string;
  specialistLabel?: string;
  activeSkillId?: string;
};

export type RoomActivityGroup = {
  roomId: string;
  activities: RoomActivity[];
  overflowCount: number;
  ambientSkillIds?: string[];
};

export type RoomActivityTicket = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  specialist?: string;
  threadId?: string;
  frontMatter?: Record<string, string>;
  updatedAt?: number;
};

type ProjectRoomActivitiesInput = {
  invocations: readonly RoomActivityInvocation[];
  projects: readonly RoomActivityProject[];
  catalog: readonly RoomActivityCatalogEntry[];
  now: number;
  recognizedSessionKeys?: ReadonlySet<string>;
};

type ProjectTicketRoomActivitiesInput = ProjectRoomActivitiesInput & {
  tickets: readonly RoomActivityTicket[];
};

function normalizePath(value: string | undefined): string {
  return (value ?? "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

function safePathBasename(value: string): string | null {
  const normalized = normalizePath(value);
  const basename = normalized.split("/").filter(Boolean).at(-1)?.trim();
  return basename || null;
}

function safeProjectLabel(value: string, trackingContext: string | undefined): string {
  const trimmed = value.trim();
  const normalized = normalizePath(trimmed);
  const looksLikeAbsolutePath = normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized);
  if (looksLikeAbsolutePath) {
    return (
      safePathBasename(normalized) ?? safePathBasename(trackingContext ?? "") ?? "Unknown project"
    );
  }
  return trimmed || safePathBasename(trackingContext ?? "") || "Unknown project";
}

function opaquePathIdentity(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `unmapped-${(hash >>> 0).toString(36)}`;
}

function resolveProject(
  projectPath: string | undefined,
  projects: readonly RoomActivityProject[],
): { identity: string; id?: string; label: string } {
  const normalizedPath = normalizePath(projectPath);
  const project = normalizedPath
    ? projects.find((candidate) => normalizePath(candidate.trackingContext) === normalizedPath)
    : undefined;
  if (project) {
    return {
      identity: project.id,
      id: project.id,
      label: safeProjectLabel(project.name, project.trackingContext),
    };
  }

  const basename = safePathBasename(normalizedPath);
  return {
    identity: normalizedPath ? opaquePathIdentity(normalizedPath) : "unknown-project",
    label: basename ?? "Unknown project",
  };
}

function activityId(
  roomId: string,
  sessionId: string | undefined,
  projectIdentity: string,
): string {
  return `${roomId}:${sessionId?.trim() || "no-session"}:${projectIdentity}`;
}

export function projectRoomActivities(input: ProjectRoomActivitiesInput): RoomActivityGroup[] {
  const roomBySkillId = new Map<string, string>();
  for (const room of input.catalog) {
    for (const skillId of room.activitySkillIds) {
      if (!roomBySkillId.has(skillId)) roomBySkillId.set(skillId, room.id);
    }
  }

  const newestByActivity = new Map<string, RoomActivity>();
  const orderedEvents = [...input.invocations].sort(
    (left, right) => right.occurredAt - left.occurredAt,
  );
  for (const event of orderedEvents) {
    const roomId = roomBySkillId.get(event.skillId);
    if (!roomId) continue;
    if (input.now - event.occurredAt >= ROOM_ACTIVITY_PRESENTATION_FRESHNESS_MS) continue;
    if (event.occurredAt > input.now) continue;

    const project = resolveProject(event.projectPath, input.projects);
    const id = activityId(roomId, event.sessionId, project.identity);
    const existing = newestByActivity.get(id);
    if (existing) {
      existing.startedAt = Math.min(existing.startedAt, event.occurredAt);
      continue;
    }

    const recognizedSession =
      event.sessionId && input.recognizedSessionKeys?.has(event.sessionId)
        ? event.sessionId
        : undefined;
    newestByActivity.set(id, {
      id,
      roomId,
      projectId: project.id,
      projectLabel: project.label,
      sessionId: event.sessionId,
      skillId: event.skillId,
      state: "active",
      startedAt: event.occurredAt,
      updatedAt: event.occurredAt,
      callerTarget: recognizedSession
        ? { kind: "session", sessionKey: recognizedSession }
        : project.id
          ? { kind: "project", projectId: project.id }
          : undefined,
      source: "telemetry",
    });
  }

  const byRoom = new Map<string, RoomActivity[]>();
  for (const activity of newestByActivity.values()) {
    const roomActivities = byRoom.get(activity.roomId) ?? [];
    roomActivities.push(activity);
    byRoom.set(activity.roomId, roomActivities);
  }

  return [...byRoom.entries()]
    .map(([roomId, activities]) => {
      activities.sort(
        (left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id),
      );
      return {
        roomId,
        activities: activities.slice(0, ROOM_ACTIVITY_VISIBLE_LIMIT),
        overflowCount: Math.max(0, activities.length - ROOM_ACTIVITY_VISIBLE_LIMIT),
      };
    })
    .sort((left, right) => left.roomId.localeCompare(right.roomId));
}

function currentInvocationBySession(
  invocations: readonly RoomActivityInvocation[],
  now: number,
): ReadonlyMap<string, RoomActivityInvocation> {
  const newestBySession = new Map<string, RoomActivityInvocation>();
  for (const event of invocations) {
    const sessionId = event.sessionId?.trim();
    if (
      !sessionId ||
      event.occurredAt > now ||
      now - event.occurredAt >= ROOM_ACTIVITY_PRESENTATION_FRESHNESS_MS
    ) {
      continue;
    }
    const current = newestBySession.get(sessionId);
    if (!current || event.occurredAt > current.occurredAt) {
      newestBySession.set(sessionId, event);
    }
  }
  return newestBySession;
}

/**
 * Projects canonical in-progress tickets into their declared specialist facility.
 * Telemetry only adds ambient room signals and the current action for an already
 * placed ticket; it cannot create, route, or duplicate a worker.
 */
export function projectTicketRoomActivities(
  input: ProjectTicketRoomActivitiesInput,
): RoomActivityGroup[] {
  const catalogRoomBySkillId = new Map<string, string>();
  for (const room of input.catalog) {
    for (const skillId of room.activitySkillIds) {
      if (!catalogRoomBySkillId.has(skillId)) catalogRoomBySkillId.set(skillId, room.id);
    }
  }

  const ambientSkillIdsByRoom = new Map<string, Set<string>>();
  for (const event of input.invocations) {
    const roomId = catalogRoomBySkillId.get(event.skillId);
    if (
      !roomId ||
      event.occurredAt > input.now ||
      input.now - event.occurredAt >= ROOM_ACTIVITY_PRESENTATION_FRESHNESS_MS
    ) {
      continue;
    }
    const skills = ambientSkillIdsByRoom.get(roomId) ?? new Set<string>();
    skills.add(event.skillId);
    ambientSkillIdsByRoom.set(roomId, skills);
  }

  const projectById = new Map(input.projects.map((project) => [project.id, project]));
  const invocationBySession = currentInvocationBySession(input.invocations, input.now);
  const activitiesByRoom = new Map<string, RoomActivity[]>();
  for (const ticket of input.tickets) {
    if (ticket.status !== "in_progress") continue;
    const specialist = resolveTicketSpecialist(ticket.specialist ?? ticket.frontMatter?.specialist);
    if (!specialist) continue;
    // Room-backed specialists pulse their activity landmark. Department service
    // bays (Sales/Deals) still reach the Council dispatch projection, but have
    // no duplicate operating-room object to pulse.
    const facilityId = specialist.roomId ?? specialist.departmentId;

    const project = projectById.get(ticket.projectId);
    const threadId = ticket.threadId?.trim() || undefined;
    const invocation = threadId ? invocationBySession.get(threadId) : undefined;
    const sessionKey = threadId ? `codex-thread:${threadId}` : undefined;
    const recognizedSession =
      sessionKey && input.recognizedSessionKeys?.has(sessionKey) ? sessionKey : undefined;
    const startedAt = ticket.updatedAt ?? input.now;
    const activity: RoomActivity = {
      id: `${facilityId}:${ticket.projectId}:${ticket.id}`,
      roomId: facilityId,
      projectId: project?.id ?? ticket.projectId,
      projectLabel: safeProjectLabel(project?.name ?? "Unknown project", project?.trackingContext),
      sessionId: threadId,
      skillId: invocation?.skillId ?? specialist.id,
      activeSkillId: invocation?.skillId,
      state: "active",
      startedAt,
      updatedAt: Math.max(startedAt, invocation?.occurredAt ?? 0),
      callerTarget: recognizedSession
        ? { kind: "session", sessionKey: recognizedSession }
        : project
          ? { kind: "project", projectId: project.id }
          : undefined,
      source: "ticket",
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      specialistId: specialist.id,
      specialistLabel: specialist.displayName,
    };
    const roomActivities = activitiesByRoom.get(facilityId) ?? [];
    roomActivities.push(activity);
    activitiesByRoom.set(facilityId, roomActivities);
  }

  const roomIds = new Set([...activitiesByRoom.keys(), ...ambientSkillIdsByRoom.keys()]);
  return [...roomIds]
    .map((roomId) => {
      const activities = activitiesByRoom.get(roomId) ?? [];
      activities.sort(
        (left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id),
      );
      return {
        roomId,
        activities: activities.slice(0, ROOM_ACTIVITY_VISIBLE_LIMIT),
        overflowCount: Math.max(0, activities.length - ROOM_ACTIVITY_VISIBLE_LIMIT),
        ambientSkillIds: [...(ambientSkillIdsByRoom.get(roomId) ?? [])].sort(),
      };
    })
    .sort((left, right) => left.roomId.localeCompare(right.roomId));
}
