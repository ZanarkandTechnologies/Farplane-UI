#!/usr/bin/env node
/**
 * Imports Aikage/Codex-era local lifecycle traces into Farplane runtime telemetry.
 * Inputs: Codex session JSONL, stop-hook JSONL, optional Aikage-compatible JSONL export.
 * Outputs: idempotent telemetry activity pings posted to Convex HTTP ingress.
 * Side effects: writes to Convex unless --dry-run is set.
 */
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_CODEX_HOME = path.join(os.homedir(), ".codex");
const DEFAULT_BATCH_SIZE = 200;
const MAX_PROMPT_LENGTH = 100;

function farplaneHome() {
  return process.env.FARPLANE_STATE_DIR?.trim() || process.env.FARPLANE_HOME?.trim() || path.join(os.homedir(), ".farplane");
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function savedConfigValue(name, { secret = false } = {}) {
  const root = farplaneHome();
  const source = readJsonObject(path.join(root, secret ? "secrets.json" : "config.json"));
  const value = source.env?.[name];
  return typeof value === "string" ? value.trim() : process.env[name]?.trim() || "";
}

function parseArgs(argv) {
  const args = {
    codexHome: process.env.CODEX_HOME || DEFAULT_CODEX_HOME,
    siteUrl: savedConfigValue("FARPLANE_CONVEX_SITE_URL") || savedConfigValue("CONVEX_SITE_URL"),
    telemetryToken: savedConfigValue("FARPLANE_TELEMETRY_TOKEN", { secret: true }),
    companyPath:
      process.env.FARPLANE_COMPANY_PATH ||
      path.join(process.env.FARPLANE_HOME || path.join(os.homedir(), ".farplane"), "company.json"),
    dryRun: false,
    includePrompts: false,
    since: 0,
    limit: 0,
    batchSize: DEFAULT_BATCH_SIZE,
    aikageJsonl: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--codex-home" && next) {
      args.codexHome = next;
      index += 1;
    } else if (arg === "--site-url" && next) {
      args.siteUrl = next;
      index += 1;
    } else if (arg === "--token" && next) {
      args.telemetryToken = next;
      index += 1;
    } else if (arg === "--company-path" && next) {
      args.companyPath = next;
      index += 1;
    } else if (arg === "--since" && next) {
      args.since = Date.parse(next);
      index += 1;
    } else if (arg === "--limit" && next) {
      args.limit = Math.max(0, Number.parseInt(next, 10) || 0);
      index += 1;
    } else if (arg === "--batch-size" && next) {
      args.batchSize = Math.max(1, Math.min(500, Number.parseInt(next, 10) || DEFAULT_BATCH_SIZE));
      index += 1;
    } else if (arg === "--aikage-jsonl" && next) {
      args.aikageJsonl = next;
      index += 1;
    } else if (arg === "--include-prompts") {
      args.includePrompts = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
  }

  if (!Number.isFinite(args.since)) args.since = 0;
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/import-aikage-telemetry.mjs [options]

Options:
  --dry-run                 Build rows and print a summary without writing to Convex.
  --site-url <url>          Convex site URL. Defaults to FARPLANE_CONVEX_SITE_URL or CONVEX_SITE_URL.
  --token <token>           Optional FARPLANE_TELEMETRY_TOKEN for protected deployments.
  --codex-home <path>       Codex home containing sessions and .farplane logs.
  --company-path <path>     Farplane company.json for project/team mapping.
  --since <date>            Import rows at or after this date.
  --limit <n>               Import at most n rows after sorting/deduping.
  --batch-size <n>          HTTP batch size, 1-500. Default ${DEFAULT_BATCH_SIZE}.
  --include-prompts         Include the first ${MAX_PROMPT_LENGTH} chars of user prompts.
  --aikage-jsonl <path>     Optional Aikage-compatible JSONL export to import too.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectResolver = await buildProjectResolver(args.companyPath);
  const pings = [];
  pings.push(
    ...(await readCodexSessionPings(args.codexHome, projectResolver, args.includePrompts)),
  );
  pings.push(...(await readStopHookPings(args.codexHome, projectResolver)));
  if (args.aikageJsonl) {
    pings.push(
      ...(await readAikageJsonlPings(args.aikageJsonl, projectResolver, args.includePrompts)),
    );
  }

  const deduped = dedupePings(pings)
    .filter((ping) => !args.since || ping.receivedAt >= args.since)
    .sort((left, right) => left.receivedAt - right.receivedAt);
  const selected = args.limit > 0 ? deduped.slice(0, args.limit) : deduped;
  const summary = summarize(selected);

  if (args.dryRun) {
    console.log(
      JSON.stringify({ ok: true, dryRun: true, summary, sample: selected.slice(0, 5) }, null, 2),
    );
    return;
  }
  if (!args.siteUrl.trim()) {
    throw new Error("Missing Convex site URL. Pass --site-url or set CONVEX_SITE_URL.");
  }

  const result = await postBatches(args.siteUrl, args.telemetryToken, selected, args.batchSize);
  console.log(
    JSON.stringify({ ok: true, dryRun: false, summary, imported: result.imported }, null, 2),
  );
}

async function buildProjectResolver(companyPath) {
  const fallback = (cwd) => ({
    projectId: undefined,
    teamId: undefined,
    projectName: cwd ? path.basename(cwd) : undefined,
  });
  if (!existsSync(companyPath)) return fallback;

  let company;
  try {
    company = JSON.parse(await readFile(companyPath, "utf-8"));
  } catch {
    return fallback;
  }

  const projects = Array.isArray(company.projects) ? company.projects : [];
  return (cwd) => {
    if (!cwd) return fallback(cwd);
    const normalizedCwd = path.resolve(cwd);
    const basename = path.basename(normalizedCwd).toLowerCase();
    const match = projects.find((project) => {
      const id = typeof project.id === "string" ? project.id : "";
      const name = typeof project.name === "string" ? project.name : "";
      const trackingContext =
        typeof project.trackingContext === "string" ? project.trackingContext : "";
      return (
        (trackingContext && path.resolve(expandHome(trackingContext)) === normalizedCwd) ||
        (name && basename.includes(name.toLowerCase().replace(/\s+/g, "-"))) ||
        (id && basename.includes(id.replace(/^proj-/, "").toLowerCase()))
      );
    });
    if (!match) return fallback(cwd);
    return {
      projectId: match.id,
      teamId: match.id ? `team-${match.id}`.toLowerCase() : undefined,
      projectName: match.name || path.basename(cwd),
    };
  };
}

async function readCodexSessionPings(codexHome, projectResolver, includePrompts) {
  const files = [];
  for (const root of [
    path.join(codexHome, "sessions"),
    path.join(codexHome, "archived_sessions"),
  ]) {
    files.push(...(await listJsonlFiles(root)));
  }

  const pings = [];
  for (const filePath of files) {
    const rows = await readJsonl(filePath);
    let sessionId = "";
    let cwd = "";
    for (const row of rows) {
      if (row.type === "session_meta" && row.payload) {
        sessionId = cleanString(row.payload.id) || sessionId;
        cwd = cleanString(row.payload.cwd) || cwd;
      }
      if (row.type === "turn_context" && row.payload) {
        cwd = cleanString(row.payload.cwd) || cwd;
      }
      if (row.type !== "event_msg" || row.payload?.type !== "task_started") continue;
      const turnId = cleanString(row.payload.turn_id);
      const receivedAt = timestampToMs(row.payload.started_at) || timestampToMs(row.timestamp);
      if (!turnId || !receivedAt) continue;
      pings.push(
        buildPing({
          eventType: "turn_start",
          source: "codex-session-import",
          cwd,
          sessionId,
          turnId,
          receivedAt,
          projectResolver,
          prompt: includePrompts ? findUserPrompt(rows, turnId, receivedAt) : undefined,
          importKey: `codex-session:${sessionId}:${turnId}:turn_start`,
        }),
      );
    }
  }
  return pings;
}

async function readStopHookPings(codexHome, projectResolver) {
  const filePath = path.join(codexHome, ".farplane", "logs", "stop-hook.jsonl");
  const rows = await readJsonl(filePath);
  return rows
    .map((row) => {
      const payload = parseRawPreview(cleanString(row.raw_preview)) || {};
      const sessionId = cleanString(row.session_id) || cleanString(payload.session_id);
      const turnId = cleanString(row.turn_id) || cleanString(payload.turn_id);
      const cwd =
        cleanString(row.cwd) || cleanString(row.cwd_from_payload) || cleanString(payload.cwd);
      const receivedAt = timestampToMs(row.timestamp);
      if (!sessionId || !turnId || !receivedAt) return null;
      return buildPing({
        eventType: "turn_end",
        source: "codex-stop-hook-import",
        cwd,
        sessionId,
        turnId,
        receivedAt,
        projectResolver,
        importKey: `codex-stop:${sessionId}:${turnId}:turn_end`,
      });
    })
    .filter(Boolean);
}

async function readAikageJsonlPings(filePath, projectResolver, includePrompts) {
  const rows = await readJsonl(filePath);
  return rows
    .map((row, index) => {
      const eventType = cleanString(row.eventType);
      if (eventType !== "heartbeat" && eventType !== "turn_start" && eventType !== "turn_end")
        return null;
      const receivedAt =
        timestampToMs(row.receivedAt) ||
        timestampToMs(row.timestamp) ||
        timestampToMs(row.createdAt) ||
        Date.now();
      return buildPing({
        eventType,
        source: cleanString(row.source) || "aikage-jsonl-import",
        cwd: cleanString(row.projectDirectory),
        sessionId: cleanString(row.sessionId),
        turnId: cleanString(row.turnId) || `aikage-row-${index}`,
        receivedAt,
        projectResolver,
        activeAgentCount: typeof row.activeAgentCount === "number" ? row.activeAgentCount : 1,
        prompt: includePrompts ? cleanString(row.prompt)?.slice(0, MAX_PROMPT_LENGTH) : undefined,
        agentName: cleanString(row.agentName),
        workflowName: cleanString(row.workflowName),
        machineName: cleanString(row.machineName),
        projectName: cleanString(row.projectName),
        projectId: cleanString(row.projectId),
        teamId: cleanString(row.teamId),
        importKey:
          cleanString(row.importKey) ||
          `aikage-jsonl:${cleanString(row.sessionId) || "unknown"}:${cleanString(row.turnId) || index}:${eventType}:${receivedAt}`,
      });
    })
    .filter(Boolean);
}

function buildPing(input) {
  const resolved = input.projectResolver(input.cwd);
  return {
    eventType: input.eventType,
    source: input.source,
    activeAgentCount: input.activeAgentCount || 1,
    prompt: input.prompt,
    agentName: input.agentName,
    workflowName: input.workflowName,
    machineName: input.machineName || os.hostname(),
    projectName: input.projectName || resolved.projectName,
    projectDirectory: input.cwd,
    projectId: input.projectId || resolved.projectId,
    teamId: input.teamId || resolved.teamId,
    sessionId: input.sessionId,
    turnId: input.turnId,
    receivedAt: input.receivedAt,
    importKey: input.importKey,
  };
}

async function listJsonlFiles(root) {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonlFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(entryPath);
    }
  }
  return files;
}

async function readJsonl(filePath) {
  if (!filePath || !existsSync(filePath)) return [];
  const raw = await readFile(filePath, "utf-8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function parseRawPreview(rawPreview) {
  if (!rawPreview) return null;
  try {
    return JSON.parse(rawPreview);
  } catch {
    return {
      session_id: extractJsonStringField(rawPreview, "session_id"),
      turn_id: extractJsonStringField(rawPreview, "turn_id"),
      cwd: extractJsonStringField(rawPreview, "cwd"),
    };
  }
}

function extractJsonStringField(raw, fieldName) {
  const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = raw.match(new RegExp(`"${escapedField}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return undefined;
  return match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function findUserPrompt(rows, _turnId, startedAt) {
  const candidates = rows.filter((row) => {
    const timestamp = timestampToMs(row.timestamp);
    if (!timestamp || Math.abs(timestamp - startedAt) > 60_000) return false;
    return row.type === "event_msg" && row.payload?.type === "user_message";
  });
  const match = candidates[0];
  const message = cleanString(match?.payload?.message);
  if (message) return message.slice(0, MAX_PROMPT_LENGTH);

  const direct = rows.find((row) => {
    if (
      row.type !== "response_item" ||
      row.payload?.type !== "message" ||
      row.payload?.role !== "user"
    )
      return false;
    return extractText(row.payload.content).trim();
  });
  const text = extractText(direct?.payload?.content).trim();
  return text ? text.slice(0, MAX_PROMPT_LENGTH) : undefined;
}

function extractText(content) {
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item?.text === "string") return item.text;
      if (typeof item?.content === "string") return item.content;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function dedupePings(pings) {
  const seen = new Set();
  const rows = [];
  for (const ping of pings) {
    if (!ping?.eventType || !ping?.turnId || !ping?.receivedAt) continue;
    const key =
      ping.importKey ||
      `${ping.source}:${ping.sessionId}:${ping.turnId}:${ping.eventType}:${ping.receivedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(stripUndefined(ping));
  }
  return rows;
}

function summarize(pings) {
  const byEventType = {};
  const byProject = {};
  let earliest = null;
  let latest = null;
  for (const ping of pings) {
    byEventType[ping.eventType] = (byEventType[ping.eventType] || 0) + 1;
    const project = ping.projectName || ping.projectDirectory || "Unknown";
    byProject[project] = (byProject[project] || 0) + 1;
    earliest = earliest === null ? ping.receivedAt : Math.min(earliest, ping.receivedAt);
    latest = latest === null ? ping.receivedAt : Math.max(latest, ping.receivedAt);
  }
  return {
    totalPings: pings.length,
    byEventType,
    byProject,
    earliest: earliest ? new Date(earliest).toISOString() : null,
    latest: latest ? new Date(latest).toISOString() : null,
  };
}

async function postBatches(siteUrl, token, pings, batchSize) {
  let imported = 0;
  const endpoint = new URL("/telemetry/hooks/batch", siteUrl).toString();
  for (let index = 0; index < pings.length; index += batchSize) {
    const batch = pings.slice(index, index + batchSize);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-farplane-telemetry-token": token } : {}),
      },
      body: JSON.stringify({ events: batch.map(pingToHookTelemetryEvent) }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex batch import failed (${response.status}): ${text}`);
    }
    const body = await response.json();
    imported += body.count || batch.length;
  }
  return { imported };
}

function pingToHookTelemetryEvent(ping) {
  const hookType =
    ping.eventType === "turn_start"
      ? "TurnStart"
      : ping.eventType === "turn_end"
        ? "TurnEnd"
        : "Heartbeat";
  return {
    hookName: ping.source || "runtime-telemetry-import",
    hookType,
    projectId: ping.projectId,
    sessionId: ping.sessionId,
    payload: {
      turnId: ping.turnId,
      prompt: ping.prompt,
      activeAgentCount: ping.activeAgentCount,
      agentName: ping.agentName,
      workflowName: ping.workflowName,
      machineName: ping.machineName,
      projectName: ping.projectName,
      projectDirectory: ping.projectDirectory,
      legacyTeamId: ping.teamId,
    },
    eventAt: ping.receivedAt,
    eventKey: ping.importKey,
  };
}

function timestampToMs(value) {
  if (typeof value === "number") return value > 1_000_000_000_000 ? value : value * 1000;
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function expandHome(value) {
  if (!value.startsWith("~")) return value;
  return path.join(os.homedir(), value.slice(1));
}

function stripUndefined(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
