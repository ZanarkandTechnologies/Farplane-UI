import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { parseIngestPayload, parseStatusReportPayload } from "./status-http-contract";

const http = httpRouter();

http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
    }
    const parsed = parseStatusReportPayload(body);
    if (!parsed) return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), { status: 400 });
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

export default http;
