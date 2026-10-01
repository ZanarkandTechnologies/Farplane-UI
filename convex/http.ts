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
 * - `/telemetry/hooks`, `/telemetry/hooks/batch`, `/ingest` (telemetry `events`)
 * - `/metrics/readings` (one reading, or `{ readings: [...] }`), `/metrics/latest`, `/metrics/history`
 * - `/experiments/ab` (`{ op, ...args }`, see EXPERIMENT_OPS), `/experiments/list`, `/experiments/get`
 *
 * Every POST route checks FARPLANE_TELEMETRY_TOKEN (`x-farplane-telemetry-token` or `Authorization: Bearer`).
 * Metrics and experiments routes fail closed (503) while it is unset; ingest routes stay open then.
 *
 * MEMORY REFERENCES:
 * - MEM-0212
 * - MEM-0216
 */
import { type FunctionReference, httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { type ActionCtx, httpAction } from "./_generated/server";
import {
  parseHookTelemetryBatchPayload,
  parseHookTelemetryPayload,
} from "./modules/hookTelemetry/httpContracts";
import {
  hasTelemetryToken,
  parseIngestPayload,
  privateRouteRefusal,
  parseStatusReportPayload,
  parseTeamActivityQueryPayload,
} from "./status_http_contract";

const http = httpRouter();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * The request's JSON object (an empty body reads as `{}`) once the token checks out, or the refusal to send
 * back. Private routes (metrics, experiments) fail closed: 503 while the deployment has no token.
 */
async function authedBody(request: Request): Promise<Record<string, unknown> | Response> {
  const refusal = privateRouteRefusal(request.headers, process.env.FARPLANE_TELEMETRY_TOKEN);
  if (refusal) return json(refusal.status, { ok: false, error: refusal.error });
  let body: unknown;
  try {
    const raw = await request.text();
    body = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json(400, { ok: false, error: "invalid_payload" });
  }
  return body as Record<string, unknown>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" ? error.data : JSON.stringify(error.data);
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}

/** Runs an internal mutation for a route: 200 with its result, or 400 with why it was refused. */
async function runRouteMutation(
  ctx: ActionCtx,
  fn: FunctionReference<"mutation", "internal">,
  args: Record<string, unknown>,
): Promise<Response> {
  try {
    const result = await ctx.runMutation(fn, args);
    return json(200, { ok: true, result: result ?? null });
  } catch (error) {
    return json(400, { ok: false, error: errorMessage(error) });
  }
}

/** Runs an internal query for a route: 200 with its result, or 400 with why it was refused. */
async function runRouteQuery(
  ctx: ActionCtx,
  fn: FunctionReference<"query", "internal">,
  args: Record<string, unknown>,
): Promise<Response> {
  try {
    const result = await ctx.runQuery(fn, args);
    return json(200, { ok: true, result: result ?? null });
  } catch (error) {
    return json(400, { ok: false, error: errorMessage(error) });
  }
}

/** A token-checked POST route that reads one internal query with the body as its arguments. */
function privateReadRoute(path: string, fn: FunctionReference<"query", "internal">) {
  http.route({
    path,
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const body = await authedBody(request);
      if (body instanceof Response) return body;
      return await runRouteQuery(ctx, fn, body);
    }),
  });
}

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
      internal.modules.telemetry.ingest.ingestHookTelemetry,
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
      internal.modules.telemetry.ingest.ingestHookTelemetryBatch,
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

http.route({
  path: "/metrics/readings",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await authedBody(request);
    if (body instanceof Response) return body;
    const readings = Array.isArray(body.readings) ? body.readings : [body];
    return await runRouteMutation(ctx, internal.modules.metrics.readings.recordReadings, { readings });
  }),
});

const EXPERIMENT_OPS: Record<string, FunctionReference<"mutation", "internal">> = {
  propose: internal.modules.experiments.abTests.proposeTest,
  start: internal.modules.experiments.abTests.startTest,
  pick: internal.modules.experiments.abTests.pickOption,
  outcome: internal.modules.experiments.abTests.recordOutcome,
  "source-totals": internal.modules.experiments.abTests.recordSourceTotals,
  "make-default": internal.modules.experiments.abTests.makeDefault,
  import: internal.modules.experiments.abTests.importTest,
};

http.route({
  path: "/experiments/ab",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await authedBody(request);
    if (body instanceof Response) return body;
    const { op, ...args } = body;
    const fn = typeof op === "string" ? EXPERIMENT_OPS[op] : undefined;
    if (!fn) {
      return json(400, { ok: false, error: `op is one of ${Object.keys(EXPERIMENT_OPS).join(", ")}` });
    }
    return await runRouteMutation(ctx, fn, args);
  }),
});

privateReadRoute("/metrics/latest", internal.modules.metrics.readings.latest);
privateReadRoute("/metrics/history", internal.modules.metrics.readings.history);
privateReadRoute("/experiments/list", internal.modules.experiments.abTests.listTests);
privateReadRoute("/experiments/get", internal.modules.experiments.abTests.getTest);

export default http;
