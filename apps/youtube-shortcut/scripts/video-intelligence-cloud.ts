/** Convex-backed Video Intelligence adapter for the local YouTube/Codex bridge. */
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Analysis as VideoIntelligenceAnalysis } from "./local-agent.js";

const execFileAsync = promisify(execFile);
const FARPLANE_UI_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export type { VideoIntelligenceAnalysis };

export type VideoIngestJob = {
  id: string;
  videoId: string;
  title: string;
  status: "queued" | "running" | "succeeded" | "failed";
  threadId?: string;
  dossierId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type JobBinding = {
  jobId: string;
  assetId: string;
  videoId: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type VideoIntelligenceStore = {
  readProjection(): Promise<{ jobs: VideoIngestJob[] }>;
  enqueue(input: { videoId: string; title: string }): Promise<VideoIngestJob>;
  updateJob(
    jobId: string,
    update: Partial<
      Pick<VideoIngestJob, "status" | "threadId" | "dossierId" | "error">
    >,
  ): Promise<VideoIngestJob>;
  complete(
    jobId: string,
    analysis: VideoIntelligenceAnalysis,
    threadId: string,
  ): Promise<{ id: string }>;
  fail(jobId: string, error: string, threadId?: string): Promise<VideoIngestJob>;
};

export function createVideoIntelligenceCloudStore(
  clientPromise: Promise<ConvexHttpClient> = createConvexClient(),
): VideoIntelligenceStore {
  const bindings = new Map<string, JobBinding>();
  const jobs = new Map<string, VideoIngestJob>();
  let secretPromise: Promise<string> | undefined;
  const bridgeSecret = () => (secretPromise ??= resolveBridgeSecret());

  return {
    async readProjection() {
      const client = await clientPromise;
      return client.query(
        api.modules.videoIntelligence.projection.getVideoIntelligenceProjection,
        {},
      );
    },

    async enqueue(input) {
      const [client, secret] = await Promise.all([clientPromise, bridgeSecret()]);
      const binding = await client.mutation(
        api.modules.videoIntelligence.videos.queueVideo,
        { ...input, bridgeSecret: secret },
      );
      const normalized: JobBinding = {
        ...binding,
        jobId: String(binding.jobId),
        assetId: String(binding.assetId),
      };
      bindings.set(normalized.jobId, normalized);
      const job = toJob(normalized, "queued");
      jobs.set(job.id, job);
      return job;
    },

    async updateJob(jobId, update) {
      const binding = requireBinding(bindings, jobId);
      const current = jobs.get(jobId) ?? toJob(binding, "queued");
      if (update.threadId) {
        const [client, secret] = await Promise.all([clientPromise, bridgeSecret()]);
        await client.mutation(api.modules.videoIntelligence.videos.attachThread, {
          bridgeSecret: secret,
          jobId: binding.jobId as never,
          threadId: update.threadId,
        });
      }
      const job = {
        ...current,
        ...update,
        updatedAt: new Date().toISOString(),
      };
      jobs.set(jobId, job);
      return job;
    },

    async complete(jobId, analysis, threadId) {
      const binding = requireBinding(bindings, jobId);
      const [client, secret] = await Promise.all([clientPromise, bridgeSecret()]);
      const result = await client.mutation(
        api.modules.videoIntelligence.videos.completeVideo,
        {
          bridgeSecret: secret,
          jobId: binding.jobId as never,
          assetId: binding.assetId as never,
          videoId: binding.videoId,
          threadId,
          // The payload was already parsed by local-agent's strict Zod schema. Convex's
          // generated input type models nullable keys as required, while Zod's inferred
          // transport type keeps them optional under Plasmo's compiler settings.
          analysis: analysis as never,
        },
      );
      await this.updateJob(jobId, {
        status: "succeeded",
        threadId,
        dossierId: String(result.dossierId),
        error: undefined,
      });
      return { id: String(result.dossierId) };
    },

    async fail(jobId, error, threadId) {
      const binding = requireBinding(bindings, jobId);
      const [client, secret] = await Promise.all([clientPromise, bridgeSecret()]);
      await client.mutation(api.modules.videoIntelligence.videos.failVideo, {
        bridgeSecret: secret,
        jobId: binding.jobId as never,
        error,
        threadId,
      });
      return this.updateJob(jobId, { status: "failed", error, threadId });
    },
  };
}

async function createConvexClient(): Promise<ConvexHttpClient> {
  const url = await resolveConvexUrl();
  return new ConvexHttpClient(url);
}

export async function resolveConvexUrl(
  env: Record<string, string | undefined> = process.env,
  envPath = resolve(FARPLANE_UI_ROOT, ".env.local"),
): Promise<string> {
  const direct = env.CONVEX_URL ?? env.VITE_CONVEX_URL;
  if (direct) return validateConvexUrl(direct);
  const contents = await readFile(envPath, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  });
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?(CONVEX_URL|VITE_CONVEX_URL)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    if (value) return validateConvexUrl(value);
  }
  throw new Error(
    "Convex cloud URL is missing. Set CONVEX_URL or VITE_CONVEX_URL in the environment or repo .env.local.",
  );
}

export async function resolveBridgeSecret(
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  const direct = env.VIDEO_INTELLIGENCE_BRIDGE_SECRET?.trim();
  if (direct) return direct;
  try {
    const { stdout } = await execFileAsync(
      "pnpm",
      ["exec", "convex", "env", "get", "VIDEO_INTELLIGENCE_BRIDGE_SECRET"],
      { cwd: FARPLANE_UI_ROOT, maxBuffer: 16_384 },
    );
    const secret = stdout.trim();
    if (secret) return secret;
  } catch {
    // The actionable error below intentionally omits command output and credentials.
  }
  throw new Error(
    "Video Intelligence bridge credential is unavailable. Set VIDEO_INTELLIGENCE_BRIDGE_SECRET or authenticate the local Convex CLI.",
  );
}

function validateConvexUrl(value: string): string {
  const url = new URL(value);
  const localHttp =
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error("Convex URL must use HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

function requireBinding(bindings: Map<string, JobBinding>, jobId: string): JobBinding {
  const binding = bindings.get(jobId);
  if (!binding) throw new Error(`Unknown Convex video intelligence job: ${jobId}`);
  return binding;
}

function toJob(binding: JobBinding, status: VideoIngestJob["status"]): VideoIngestJob {
  return {
    id: binding.jobId,
    videoId: binding.videoId,
    title: binding.title,
    status,
    createdAt: new Date(binding.createdAtMs).toISOString(),
    updatedAt: new Date(binding.updatedAtMs).toISOString(),
  };
}
