import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { FARPLANE_EXTENSION_ORIGIN, type AnalysisJob } from "./local-agent.js";
import {
  manifestSchema,
  reportSchema,
  type ChannelManifest,
  type ManifestIngestReport,
  type ManifestRecord,
} from "./ingest-channel-manifest-contract.js";

export const HTTP_TIMEOUT_MS = 960_000;
const EXISTING_JOB_POLL_MS = 5_000;

type HttpResponse = { status: number; body: unknown };

export class ManifestHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ManifestHttpError";
  }
}

function requestHeaders() {
  return {
    origin: FARPLANE_EXTENSION_ORIGIN,
    "x-farplane-client": "youtube-shortcut",
    "content-type": "application/json",
    connection: "close",
  };
}

export async function requestJson(
  endpoint: string,
  path: string,
  body: unknown,
): Promise<HttpResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    path === "/analyze-youtube" ? HTTP_TIMEOUT_MS : 15_000,
  );
  try {
    const response = await fetch(`${endpoint}${path}`, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { error: raw.slice(0, 1_000) };
    }
    return { status: response.status, body: parsed };
  } finally {
    clearTimeout(timeout);
  }
}

export function errorText(body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null && "error" in body) {
    const value = (body as { error?: unknown }).error;
    if (typeof value === "string" && value) return value;
  }
  return fallback;
}

export function classifyError(error: unknown): ManifestRecord["classification"] {
  const value = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  const normalized = value.toLowerCase();
  if (
    normalized.includes("no usable transcript") ||
    normalized.includes("transcript_unavailable") ||
    normalized.includes("source material")
  )
    return "source_unavailable";
  if (
    normalized.includes("auth") ||
    normalized.includes("refresh") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid token") ||
    normalized.includes("401")
  )
    return "auth";
  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("aborterror")
  )
    return "timeout";
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("econn") ||
    normalized.includes("socket")
  )
    return "transport";
  if (normalized.includes("personalized output")) return "validation";
  if (error instanceof ManifestHttpError && error.status >= 400 && error.status < 500)
    return "validation";
  return "unknown";
}

export function now() {
  return new Date().toISOString();
}

export function summarize(
  records: ManifestRecord[],
  total: number,
): ManifestIngestReport["summary"] {
  const succeeded = records.filter((record) => record.status === "succeeded").length;
  const skipped = records.filter((record) => record.status === "skipped").length;
  const failed = records.filter((record) => record.status === "failed").length;
  const blocked = records.filter((record) => record.status === "blocked").length;
  return {
    total,
    succeeded,
    skipped,
    failed,
    blocked,
    unresolved: Math.max(0, total - succeeded - skipped - failed - blocked),
  };
}

export async function writeAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export async function loadChannelManifest(path: string): Promise<ChannelManifest> {
  const value = JSON.parse(await readFile(path, "utf8"));
  const manifest = manifestSchema.parse(value);
  const ids = manifest.videos.map((video) => video.videoId);
  if (new Set(ids).size !== ids.length) throw new Error("Manifest contains duplicate video IDs");
  return manifest;
}

export async function loadReport(path: string): Promise<ManifestIngestReport | null> {
  try {
    return reportSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof SyntaxError) throw new Error(`Manifest report is not valid JSON: ${path}`);
    if (error instanceof z.ZodError) throw new Error(`Manifest report does not match schema: ${path}`);
    throw error;
  }
}

export async function readJobs(endpoint: string): Promise<AnalysisJob[]> {
  const response = await requestJson(endpoint, "/jobs", {});
  if (response.status !== 200)
    throw new ManifestHttpError(
      response.status,
      errorText(response.body, `Jobs endpoint returned ${response.status}`),
    );
  const jobs = (response.body as { jobs?: unknown })?.jobs;
  if (!Array.isArray(jobs)) throw new Error("Jobs endpoint returned no jobs array");
  return jobs as AnalysisJob[];
}

export function matchingJobs(jobs: AnalysisJob[], videoId: string) {
  return jobs.filter((job) => job.videoId === videoId);
}

export async function waitForCanonicalJob(
  endpoint: string,
  videoId: string,
): Promise<{ jobs: AnalysisJob[]; job?: AnalysisJob }> {
  const deadline = Date.now() + HTTP_TIMEOUT_MS;
  let jobs = await readJobs(endpoint);
  while (true) {
    const matching = matchingJobs(jobs, videoId);
    if (matching.length > 1) throw new Error(`Duplicate canonical jobs/assets found for ${videoId}`);
    const job = matching[0];
    if (!job || (job.status !== "queued" && job.status !== "running")) return { jobs, job };
    if (Date.now() >= deadline) throw new Error(`Existing canonical job remained active for ${videoId}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, EXISTING_JOB_POLL_MS));
    jobs = await readJobs(endpoint);
  }
}
