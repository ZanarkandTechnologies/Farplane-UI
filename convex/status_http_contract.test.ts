import { describe, expect, it } from "vitest";
import {
  hasTelemetryToken,
  parseIngestPayload,
  parseStatusReportPayload,
  parseTeamActivityQueryPayload,
} from "./status_http_contract";

describe("status-http-contract", () => {
  it("parses valid ingest payload", () => {
    const parsed = parseIngestPayload({
      agentId: "main",
      eventType: "status_report",
      label: "planning",
      detail: "Reviewing backlog",
    });
    expect(parsed).toEqual({
      teamId: undefined,
      projectId: undefined,
      agentId: "main",
      eventType: "status_report",
      activityType: undefined,
      actorType: undefined,
      label: "planning",
      detail: "Reviewing backlog",
      state: undefined,
      skillId: undefined,
      source: undefined,
      stepKey: undefined,
      sessionKey: undefined,
      beatId: undefined,
      taskId: undefined,
      occurredAt: undefined,
    });
  });

  it("rejects ingest payload missing required fields", () => {
    expect(parseIngestPayload({ agentId: "main", label: "x" })).toBeNull();
  });

  it("parses valid status report payload", () => {
    const parsed = parseStatusReportPayload({
      agentId: "main",
      state: "executing",
      statusText: "Running distribution",
      stepKey: "main-step-1",
      beatId: "beat-main-1",
    });
    expect(parsed?.agentId).toBe("main");
    expect(parsed?.teamId).toBeUndefined();
    expect(parsed?.state).toBe("executing");
    expect(parsed?.statusText).toBe("Running distribution");
    expect(parsed?.stepKey).toBe("main-step-1");
    expect(parsed?.beatId).toBe("beat-main-1");
  });

  it("parses optional skillId in status payloads", () => {
    const ingest = parseIngestPayload({
      agentId: "main",
      eventType: "activity_log",
      label: "executing",
      skillId: "world-monitor",
    });
    const report = parseStatusReportPayload({
      agentId: "main",
      state: "executing",
      statusText: "Checking world monitor",
      stepKey: "main-step-2",
      skillId: "world-monitor",
    });
    expect(ingest?.skillId).toBe("world-monitor");
    expect(report?.skillId).toBe("world-monitor");
  });

  it("rejects status report payload with blank stepKey", () => {
    expect(
      parseStatusReportPayload({
        agentId: "main",
        state: "planning",
        statusText: "Planning",
        stepKey: "   ",
      }),
    ).toBeNull();
  });

  it("parses optional teamId in status payloads", () => {
    const ingest = parseIngestPayload({
      teamId: "team-proj-alpha",
      agentId: "main",
      eventType: "status_report",
      label: "planning",
    });
    const report = parseStatusReportPayload({
      teamId: "team-proj-alpha",
      agentId: "main",
      state: "planning",
      statusText: "Planning",
      stepKey: "main-step",
    });
    expect(ingest?.teamId).toBe("team-proj-alpha");
    expect(report?.teamId).toBe("team-proj-alpha");
  });

  it("parses the status-owned team activity read contract", () => {
    expect(
      parseTeamActivityQueryPayload({
        teamId: " team-proj-alpha ",
        projectId: " proj-alpha ",
        limit: 25.8,
        agentId: " researcher ",
      }),
    ).toEqual({
      teamId: "team-proj-alpha",
      projectId: "proj-alpha",
      limit: 25,
      agentId: "researcher",
    });
  });

  it("requires a team id for activity reads", () => {
    expect(parseTeamActivityQueryPayload({ projectId: "proj-alpha" })).toBeNull();
    expect(parseTeamActivityQueryPayload([])).toBeNull();
  });

  it("keeps status and activity endpoints open when no telemetry token is configured", () => {
    expect(hasTelemetryToken(new Headers(), undefined)).toBe(true);
    expect(hasTelemetryToken(new Headers(), "   ")).toBe(true);
  });

  it("accepts the configured telemetry token from the header or bearer auth", () => {
    expect(
      hasTelemetryToken(new Headers({ "x-farplane-telemetry-token": "secret" }), "secret"),
    ).toBe(true);
    expect(hasTelemetryToken(new Headers({ authorization: "Bearer secret" }), "secret")).toBe(true);
    expect(hasTelemetryToken(new Headers({ authorization: "Bearer wrong" }), "secret")).toBe(false);
    expect(hasTelemetryToken(new Headers(), "secret")).toBe(false);
  });
});
