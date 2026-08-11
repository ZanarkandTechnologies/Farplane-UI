import { describe, expect, it } from "vitest";
import {
  projectRoomActivities,
  projectTicketRoomActivities,
  ROOM_ACTIVITY_PRESENTATION_FRESHNESS_MS,
} from "./room-activity-projection";

const NOW = 1_800_000_000_000;
const catalog = [
  {
    id: "production",
    activitySkillIds: ["landing-page", "storyboard"],
  },
  {
    id: "research",
    activitySkillIds: ["research"],
  },
  {
    id: "harness",
    activitySkillIds: ["harness-creator"],
  },
] as const;
const projects = [
  { id: "acme", name: "Acme", trackingContext: "/workspace/acme" },
  { id: "nova", name: "Nova", trackingContext: "/workspace/nova" },
] as const;

function project(
  invocations: Array<{
    skillId: string;
    sessionId?: string;
    projectPath?: string;
    occurredAt: number;
  }>,
) {
  return projectRoomActivities({ invocations, projects, catalog, now: NOW });
}

describe("room activity projection", () => {
  it("maps only allowlisted activity skills", () => {
    expect(
      project([
        { skillId: "harness-creator", projectPath: "/workspace/acme", occurredAt: NOW - 1 },
        { skillId: "harness-advisor", projectPath: "/workspace/acme", occurredAt: NOW - 2 },
        { skillId: "execute", projectPath: "/workspace/acme", occurredAt: NOW - 3 },
      ]),
    ).toMatchObject([{ roomId: "harness", activities: [{ skillId: "harness-creator" }] }]);
  });

  it("keeps the same skill concurrent for two projects", () => {
    const groups = project([
      {
        skillId: "landing-page",
        sessionId: "session-acme",
        projectPath: "/workspace/acme",
        occurredAt: NOW - 20,
      },
      {
        skillId: "landing-page",
        sessionId: "session-nova",
        projectPath: "/workspace/nova",
        occurredAt: NOW - 10,
      },
    ]);

    expect(groups[0].activities.map((activity) => activity.projectLabel)).toEqual(["Nova", "Acme"]);
  });

  it("deduplicates room, session, and project with the newest event winning", () => {
    const groups = project([
      {
        skillId: "storyboard",
        sessionId: "session-acme",
        projectPath: "/workspace/acme",
        occurredAt: NOW - 200,
      },
      {
        skillId: "landing-page",
        sessionId: "session-acme",
        projectPath: "/workspace/acme",
        occurredAt: NOW - 10,
      },
    ]);

    expect(groups[0].activities).toHaveLength(1);
    expect(groups[0].activities[0]).toMatchObject({
      skillId: "landing-page",
      startedAt: NOW - 200,
      updatedAt: NOW - 10,
    });
  });

  it("expires at the fixed five-minute presentation boundary", () => {
    expect(
      project([
        {
          skillId: "landing-page",
          projectPath: "/workspace/acme",
          occurredAt: NOW - ROOM_ACTIVITY_PRESENTATION_FRESHNESS_MS,
        },
      ]),
    ).toEqual([]);
  });

  it("caps each room at three activities and reports overflow", () => {
    const groups = project(
      Array.from({ length: 5 }, (_, index) => ({
        skillId: "landing-page",
        sessionId: `session-${index}`,
        projectPath: `/private/company/project-${index}`,
        occurredAt: NOW - index,
      })),
    );

    expect(groups[0].activities).toHaveLength(3);
    expect(groups[0].overflowCount).toBe(2);
  });

  it("uses only a basename for unknown absolute paths", () => {
    const groups = project([
      {
        skillId: "landing-page",
        sessionId: "session-private",
        projectPath: "/Users/private/Secret Client",
        occurredAt: NOW - 1,
      },
    ]);

    expect(groups[0].activities[0]).toMatchObject({
      projectId: undefined,
      projectLabel: "Secret Client",
      callerTarget: undefined,
    });
    expect(JSON.stringify(groups)).not.toContain("/Users/private");
  });

  it("does not trust an absolute-path project name as a display label", () => {
    const groups = projectRoomActivities({
      catalog,
      now: NOW,
      projects: [
        {
          id: "private",
          name: "/Users/private/Secret Client",
          trackingContext: "/workspace/private",
        },
      ],
      invocations: [
        {
          skillId: "landing-page",
          projectPath: "/workspace/private",
          occurredAt: NOW - 1,
        },
      ],
    });

    expect(groups[0].activities[0].projectLabel).toBe("Secret Client");
    expect(JSON.stringify(groups)).not.toContain("/Users/private");
  });

  it("links sessions only when explicitly recognized", () => {
    const groups = projectRoomActivities({
      catalog,
      projects,
      now: NOW,
      recognizedSessionKeys: new Set(["live-session"]),
      invocations: [
        {
          skillId: "landing-page",
          sessionId: "live-session",
          projectPath: "/workspace/acme",
          occurredAt: NOW - 1,
        },
        {
          skillId: "landing-page",
          sessionId: "unrecognized-session",
          projectPath: "/private/unknown",
          occurredAt: NOW - 2,
        },
      ],
    });

    expect(groups[0].activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: "live-session",
          callerTarget: { kind: "session", sessionKey: "live-session" },
        }),
        expect.objectContaining({
          sessionId: "unrecognized-session",
          callerTarget: undefined,
        }),
      ]),
    );
  });

  it("projects concurrent specialist tickets once and keeps helper telemetry ambient", () => {
    const groups = projectTicketRoomActivities({
      catalog,
      projects,
      now: NOW,
      recognizedSessionKeys: new Set(["codex-thread:session-acme", "codex-thread:session-nova"]),
      tickets: [
        {
          id: "TASK-0042",
          projectId: "acme",
          title: "Build Acme landing page",
          status: "in_progress",
          specialist: "landing-page-specialist",
          threadId: "session-acme",
          updatedAt: NOW - 20,
        },
        {
          id: "TASK-0043",
          projectId: "nova",
          title: "Build Nova landing page",
          status: "in_progress",
          specialist: "landing-page-specialist",
          threadId: "session-nova",
          updatedAt: NOW - 10,
        },
      ],
      invocations: [
        {
          skillId: "landing-page",
          sessionId: "session-acme",
          projectPath: "/workspace/acme",
          occurredAt: NOW - 2,
        },
        {
          skillId: "research",
          sessionId: "session-acme",
          projectPath: "/workspace/acme",
          occurredAt: NOW - 1,
        },
      ],
    });

    expect(groups).toEqual([
      expect.objectContaining({
        roomId: "production",
        overflowCount: 0,
        ambientSkillIds: ["landing-page"],
        activities: expect.arrayContaining([
          expect.objectContaining({
            id: "production:acme:TASK-0042",
            source: "ticket",
            ticketTitle: "Build Acme landing page",
            activeSkillId: "research",
            callerTarget: { kind: "session", sessionKey: "codex-thread:session-acme" },
          }),
          expect.objectContaining({
            id: "production:nova:TASK-0043",
            source: "ticket",
            specialistLabel: "Landing Page Specialist",
          }),
        ]),
      }),
      expect.objectContaining({
        roomId: "research",
        activities: [],
        ambientSkillIds: ["research"],
      }),
    ]);
  });

  it("does not infer specialist placement for legacy or unknown tickets", () => {
    expect(
      projectTicketRoomActivities({
        catalog,
        projects,
        now: NOW,
        tickets: [
          {
            id: "TASK-0044",
            projectId: "acme",
            title: "Legacy task",
            status: "in_progress",
          },
          {
            id: "TASK-0045",
            projectId: "nova",
            title: "Unknown task",
            status: "in_progress",
            specialist: "paint-the-office-specialist",
          },
        ],
        invocations: [],
      }),
    ).toEqual([]);
  });
});
