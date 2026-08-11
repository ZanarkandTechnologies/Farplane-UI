/**
 * TICKET DISPATCH PROJECTION
 * ==========================
 * Translates already-ticket-first room activity into transient scene effects.
 * It reads Council sectors and fixed specialist stations, returning only
 * deterministic presentation data; it never creates agents, tickets, or
 * persistent office objects.
 */

import type { ProjectCouncilLayout } from "./project-council-layout";
import type { RoomActivity, RoomActivityCallerTarget } from "./room-activity-projection";

export type ProjectCouncilLeadPosition = {
  projectId: string;
  employeeId: string;
  position: [number, number, number];
};

export type TicketDispatch = {
  id: string;
  projectId: string;
  employeeId: string;
  specialistId: string;
  sourceHead: [number, number, number];
  destination: [number, number, number];
  cloneAppearance: { accentColor: string };
  callerTarget: RoomActivityCallerTarget;
  label: string;
};

function colorForProject(projectId: string): string {
  let value = 0;
  for (const character of projectId) value = (value * 31 + character.charCodeAt(0)) >>> 0;
  return ["#8d9c7a", "#af8c70", "#8098a7", "#9a8aab", "#b09d65"][value % 5] ?? "#8d9c7a";
}

function cloneOffset(index: number, total: number): [number, number] {
  if (total <= 1) return [0, 0];
  const angle = (Math.PI * 2 * index) / total;
  return [Math.cos(angle) * 0.46, Math.sin(angle) * 0.46];
}

/** Builds bounded ticket-driven dispatches. Telemetry-only activity intentionally never qualifies. */
export function projectTicketDispatches(input: {
  activities: readonly RoomActivity[];
  layout: ProjectCouncilLayout;
  councilLeads: readonly ProjectCouncilLeadPosition[];
}): TicketDispatch[] {
  const stationBySpecialist = new Map(
    input.layout.specialistStations.map((station) => [station.specialistId, station]),
  );
  const leadByProjectId = new Map(input.councilLeads.map((lead) => [lead.projectId, lead]));
  const eligible = input.activities
    .filter(
      (activity) =>
        activity.source === "ticket" &&
        Boolean(activity.projectId) &&
        Boolean(activity.specialistId) &&
        stationBySpecialist.has(activity.specialistId ?? "") &&
        leadByProjectId.has(activity.projectId ?? ""),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const totalBySpecialist = new Map<string, number>();
  for (const activity of eligible) {
    const specialistId = activity.specialistId as string;
    totalBySpecialist.set(specialistId, (totalBySpecialist.get(specialistId) ?? 0) + 1);
  }
  const indexBySpecialist = new Map<string, number>();

  return eligible.flatMap((activity) => {
    const projectId = activity.projectId;
    const specialistId = activity.specialistId;
    if (!projectId || !specialistId) return [];
    const station = stationBySpecialist.get(specialistId);
    const lead = leadByProjectId.get(projectId);
    if (!station || !lead) return [];
    const index = indexBySpecialist.get(specialistId) ?? 0;
    indexBySpecialist.set(specialistId, index + 1);
    const [offsetX, offsetZ] = cloneOffset(index, totalBySpecialist.get(specialistId) ?? 1);
    return [
      {
        id: `ticket-dispatch:${activity.id}`,
        projectId,
        employeeId: lead.employeeId,
        specialistId,
        sourceHead: [lead.position[0], lead.position[1] + 1.28, lead.position[2]],
        destination: [
          station.position[0] + offsetX,
          station.position[1],
          station.position[2] + offsetZ,
        ],
        cloneAppearance: { accentColor: colorForProject(projectId) },
        callerTarget: activity.callerTarget ?? { kind: "project", projectId },
        label: activity.ticketTitle ?? activity.projectLabel,
      },
    ];
  });
}
