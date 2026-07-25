/**
 * CONVEX HTTP ROUTES
 * ==================
 * Purpose
 * - Expose thin HTTP ingress for Farplane CLI and external hooks over the canonical Convex runtime.
 *
 * KEY CONCEPTS:
 * - Status writes stay mutation-backed and CLI-safe.
 * - Timeline-style reads exposed to the CLI must share the same feed contract as the UI.
 *
 * USAGE:
 * - `/status/activity`
 * - `/status/report`
 *
 * MEMORY REFERENCES:
 * - MEM-0212
 * - MEM-0216
 */
import { httpRouter } from "convex/server";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import {
  parseHookTelemetryBatchPayload,
  parseHookTelemetryPayload,
} from "./modules/hookTelemetry/httpContracts";
import {
  hasTelemetryToken,
  parseIngestPayload,
  parseStatusReportPayload,
  parseTeamActivityQueryPayload,
} from "./status_http_contract";

const http = httpRouter();

http.route({
  path: "/telemetry/hooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!hasTelemetryToken(request.headers, process.env.FARPLANE_TELEMETRY_TOKEN)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
    }

    const parsed = parseHookTelemetryPayload(body);
    if (!parsed) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), { status: 400 });
    }

    const result = await ctx.runMutation(
      internal.modules.hookTelemetry.events.ingestHookTelemetry,
      parsed,
    );
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }),
});

http.route({
  path: "/telemetry/hooks/batch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!hasTelemetryToken(request.headers, process.env.FARPLANE_TELEMETRY_TOKEN)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
    }

    const parsed = parseHookTelemetryBatchPayload(body);
    if (!parsed) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), { status: 400 });
    }

    const result = await ctx.runMutation(
      internal.modules.hookTelemetry.events.ingestHookTelemetryBatch,
      { events: parsed },
    );
    return new Response(JSON.stringify({ ok: true, count: result.ids.length, ...result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }),
});

http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!hasTelemetryToken(request.headers, process.env.FARPLANE_TELEMETRY_TOKEN)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
    }

    const parsed = parseIngestPayload(body);
    if (!parsed) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), { status: 400 });
    }

    await ctx.runMutation(internal.events.ingestEvent, {
      ...parsed,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }),
});

http.route({
  path: "/status/report",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!hasTelemetryToken(request.headers, process.env.FARPLANE_TELEMETRY_TOKEN)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
    }
    const parsed = parseStatusReportPayload(body);
    if (!parsed)
      return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), { status: 400 });
    try {
      const result = await ctx.runMutation(internal.events.reportStatus, parsed);
      return new Response(JSON.stringify({ ok: true, duplicate: result.duplicate }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/status/activity",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!hasTelemetryToken(request.headers, process.env.FARPLANE_TELEMETRY_TOKEN)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
    }
    const parsed = parseTeamActivityQueryPayload(body);
    if (!parsed)
      return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), { status: 400 });
    try {
      const data = await ctx.runQuery(api.status.getTeamActivityFeed, {
        teamId: parsed.teamId,
        projectId: parsed.projectId,
        limit: parsed.limit,
        agentId: parsed.agentId,
      });
      return new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }),
});

export default http;
