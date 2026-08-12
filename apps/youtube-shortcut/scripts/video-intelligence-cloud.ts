/** Convex-backed Video Intelligence adapter for the local YouTube/Codex bridge. */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Analysis as VideoIntelligenceAnalysis } from "./local-agent.js";

const FARPLANE_UI_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export type { VideoIntelligenceAnalysis };

export type VideoIngestJob = {
  id: string;
  sourceId?: string;
  videoId: string;
  title: string;
  projectId?: string;
  status: "queued" | "running" | "succeeded" | "failed";
  threadId?: string;
  dossierId?: string;
  disposition?: "created" | "reused_active" | "reused_ready";
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type JobBinding = {
  jobId: string;
  sourceId: string;
  videoId: string;
  title: string;
  projectId?: string;
  disposition: "created" | "reused_active" | "reused_ready";
  jobStatus: "queued" | "analyzing" | "ready" | "failed" | "needs_review";
  dossierId?: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type VideoIntelligenceStore = {
  readProjection(): Promise<{ jobs: VideoIngestJob[] }>;
  enqueue(input: {
    videoId: string;
    title: string;
    projectId?: string;
    channelId?: string;
    reAnalyze?: boolean;
  }): Promise<VideoIngestJob>;
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

  return {
    async readProjection() {
      const client = await clientPromise;
      return client.query(
        api.modules.videoIntelligence.projection.getVideoIntelligenceProjection,
        {},
      );
    },

    async enqueue(input) {
      const client = await clientPromise;
      const binding = await client.mutation(
        api.modules.videoIntelligence.videos.queueVideo,
        input,
      );
      const normalized: JobBinding = {
        ...binding,
        jobId: String(binding.jobId),
        sourceId: String(binding.sourceId),
      };
      bindings.set(normalized.jobId, normalized);
      const job = toJob(normalized, localJobStatus(normalized.jobStatus));
      jobs.set(job.id, job);
      return job;
    },

    async updateJob(jobId, update) {
      const binding = requireBinding(bindings, jobId);
      const current = jobs.get(jobId) ?? toJob(binding, "queued");
      if (update.status === "running") {
        const client = await clientPromise;
        await client.mutation(api.modules.videoIntelligence.videos.startVideo, {
          jobId: binding.jobId as never,
        });
      }
      if (update.threadId) {
        const client = await clientPromise;
        await client.mutation(api.modules.videoIntelligence.videos.attachThread, {
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
      const client = await clientPromise;
      const result = await client.mutation(
        api.modules.videoIntelligence.videos.completeVideo,
        {
          jobId: binding.jobId as never,
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
      const client = await clientPromise;
      await client.mutation(api.modules.videoIntelligence.videos.failVideo, {
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
    sourceId: binding.sourceId,
    videoId: binding.videoId,
    title: binding.title,
    projectId: binding.projectId,
    disposition: binding.disposition,
    dossierId: binding.dossierId,
    status,
    createdAt: new Date(binding.createdAtMs).toISOString(),
    updatedAt: new Date(binding.updatedAtMs).toISOString(),
  };
}

function localJobStatus(status: JobBinding["jobStatus"]): VideoIngestJob["status"] {
  if (status === "ready") return "succeeded";
  if (status === "analyzing") return "running";
  if (status === "queued") return "queued";
  return "failed";
}
