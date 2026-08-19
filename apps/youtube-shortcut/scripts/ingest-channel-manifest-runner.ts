import { resolve } from "node:path";
import type { ChannelManifest, ManifestIngestReport, ManifestRecord, ManifestRunnerOptions } from "./ingest-channel-manifest-contract.js";
import {
  ManifestHttpError,
  classifyError,
  errorText,
  loadChannelManifest,
  loadReport,
  matchingJobs,
  now,
  readJobs,
  requestJson,
  summarize,
  waitForCanonicalJob,
  writeAtomic,
} from "./ingest-channel-manifest-transport.js";

const DEFAULT_ENDPOINT = "http://127.0.0.1:47893";
const DEFAULT_PROJECT_ID = "Vidgard" as const;
const MAX_ATTEMPTS = 2;
const DEFAULT_CONCURRENCY = 5;
const MAX_CONCURRENCY = 5;

function recordFor(
  video: ChannelManifest["videos"][number],
  patch: Partial<ManifestRecord> & Pick<ManifestRecord, "status" | "classification">,
): ManifestRecord {
  return {
    videoId: video.videoId,
    title: video.title,
    attempts: 0,
    updatedAt: now(),
    ...patch,
  };
}

export async function runManifestIngest(
  options: ManifestRunnerOptions & { defaultManifestPath: string; defaultReportPath: string },
): Promise<ManifestIngestReport> {
  const manifestPath = resolve(options.manifestPath ?? options.defaultManifestPath);
  const reportPath = resolve(options.reportPath ?? options.defaultReportPath);
  const endpoint = (options.endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, "");
  const projectId = options.projectId ?? DEFAULT_PROJECT_ID;
  if (options.maxSources !== undefined && (!Number.isInteger(options.maxSources) || options.maxSources < 0))
    throw new Error("maxSources must be a non-negative integer");
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_CONCURRENCY)
    throw new Error(`concurrency must be an integer from 1 to ${MAX_CONCURRENCY}`);

  const manifest = await loadChannelManifest(manifestPath);
  const previous = await loadReport(reportPath);
  const records = new Map(previous?.videos.map((record) => [record.videoId, record]) ?? []);
  const startedAt = previous?.startedAt ?? now();
  const report = () => ({
    schemaVersion: 1 as const,
    manifestPath,
    channelUrl: manifest.channelUrl,
    requestedYear: manifest.requestedYear,
    projectId,
    endpoint,
    startedAt,
    updatedAt: now(),
    videos: [...records.values()].sort((left, right) => left.videoId.localeCompare(right.videoId)),
    summary: summarize([...records.values()], manifest.videos.length),
  });

  const health = await requestJson(endpoint, "/health", {});
  const healthBody = health.body as {
    ok?: unknown;
    service?: unknown;
    appServer?: unknown;
    intelligestSkill?: unknown;
  };
  if (
    health.status !== 200 ||
    healthBody.ok !== true ||
    healthBody.service !== true ||
    healthBody.appServer !== true ||
    healthBody.intelligestSkill !== true
  )
    throw new Error(`YouTube bridge health check failed: ${JSON.stringify(health.body)}`);

  const jobs = await readJobs(endpoint);
  const orderedVideos = [...manifest.videos].sort((left, right) => {
    const rank = (videoId: string) => {
      const job = matchingJobs(jobs, videoId)[0];
      if (!job) return 1;
      if (job.status === "succeeded" && job.projectId !== projectId) return 2;
      if (job.status === "failed" && classifyError(job.error) === "auth") return 3;
      if (job.status === "failed" && classifyError(job.error) === "timeout") return 0;
      return 1;
    };
    return rank(left.videoId) - rank(right.videoId);
  });
  let processed = 0;
  let nextVideoIndex = 0;
  let fatalError: Error | undefined;
  let reportWriteTail = Promise.resolve();
  const persistReport = async () => {
    const write = reportWriteTail.then(() => writeAtomic(reportPath, report()));
    reportWriteTail = write.catch(() => undefined);
    await write;
  };

  const processVideo = async (video: ChannelManifest["videos"][number]) => {
    if (fatalError) return;
    const currentJobs = await readJobs(endpoint);
    const matching = matchingJobs(currentJobs, video.videoId);
    if (matching.length > 1)
      throw new Error(`Duplicate canonical jobs/assets found for ${video.videoId}`);
    let existing = matching[0];
    if (existing?.status === "queued" || existing?.status === "running") {
      const settled = await waitForCanonicalJob(endpoint, video.videoId);
      existing = settled.job;
    }
    const prior = records.get(video.videoId);
    if (existing?.status === "succeeded" && existing.projectId === projectId) {
      records.set(
        video.videoId,
        recordFor(video, {
          status: "skipped",
          classification: "none",
          attempts: prior?.attempts ?? 0,
          projectId: existing.projectId,
          jobId: existing.id,
          sourceId: existing.sourceId,
        }),
      );
      await persistReport();
      return;
    }
    const existingClassification = existing?.error ? classifyError(existing.error) : undefined;
    if (existing?.status === "failed" && existingClassification === "auth") {
      records.set(
        video.videoId,
        recordFor(video, {
          status: "blocked",
          classification: "auth",
          attempts: prior?.attempts ?? 1,
          projectId: existing.projectId,
          jobId: existing.id,
          sourceId: existing.sourceId,
          error: existing.error,
        }),
      );
      await persistReport();
      return;
    }
    if (
      existing?.status === "failed" &&
      (existingClassification === "source_unavailable" || existingClassification === "validation")
    ) {
      records.set(
        video.videoId,
        recordFor(video, {
          status: "failed",
          classification: existingClassification,
          attempts: prior?.attempts ?? 1,
          projectId: existing.projectId,
          jobId: existing.id,
          sourceId: existing.sourceId,
          error: existing.error,
        }),
      );
      await persistReport();
      return;
    }
    if (prior?.status === "blocked" || (prior?.attempts ?? 0) >= MAX_ATTEMPTS) return;
    if (options.maxSources !== undefined && processed >= options.maxSources) return;
    processed += 1;

    let finalRecord: ManifestRecord | undefined;
    for (let attempt = (prior?.attempts ?? 0) + 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await requestJson(endpoint, "/analyze-youtube", {
          videoId: video.videoId,
          title: video.title,
          projectId,
        });
        if (response.status !== 200) {
          const message = errorText(response.body, `Analysis endpoint returned ${response.status}`);
          throw new ManifestHttpError(response.status, message);
        }
        const reconciledJobs = await readJobs(endpoint);
        const reconciled = matchingJobs(reconciledJobs, video.videoId);
        if (reconciled.length !== 1)
          throw new Error(`Canonical reconciliation found ${reconciled.length} jobs for ${video.videoId}`);
        const job = reconciled[0];
        if (job.status !== "succeeded" || job.projectId !== projectId)
          throw new Error(
            `Canonical reconciliation failed for ${video.videoId}: ${job.status}/${job.projectId ?? "unassigned"}`,
          );
        finalRecord = recordFor(video, {
          status: "succeeded",
          classification: "none",
          attempts: attempt,
          projectId: job.projectId,
          jobId: job.id,
          sourceId: job.sourceId,
          threadId:
            typeof response.body === "object" && response.body !== null && "threadId" in response.body
              ? String((response.body as { threadId?: unknown }).threadId ?? "") || undefined
              : undefined,
        });
        break;
      } catch (error) {
        const classification = classifyError(error);
        const message = error instanceof Error ? error.message : String(error);
        if (classification === "transport" || classification === "timeout") {
          const settled = await waitForCanonicalJob(endpoint, video.videoId);
          const job = settled.job;
          if (job?.status === "succeeded" && job.projectId === projectId) {
            finalRecord = recordFor(video, {
              status: "succeeded",
              classification: "none",
              attempts: attempt,
              projectId: job.projectId,
              jobId: job.id,
              sourceId: job.sourceId,
            });
            break;
          }
          const jobClassification = job?.error ? classifyError(job.error) : undefined;
          if (
            job?.status === "failed" &&
            (jobClassification === "source_unavailable" || jobClassification === "validation")
          ) {
            finalRecord = recordFor(video, {
              status: "failed",
              classification: jobClassification,
              attempts: attempt,
              projectId: job.projectId,
              jobId: job.id,
              sourceId: job.sourceId,
              error: job.error,
            });
            break;
          }
          if (job?.status === "failed" && jobClassification === "auth") {
            finalRecord = recordFor(video, {
              status: "blocked",
              classification: "auth",
              attempts: attempt,
              projectId: job.projectId,
              jobId: job.id,
              sourceId: job.sourceId,
              error: job.error,
            });
            records.set(video.videoId, finalRecord);
            await persistReport();
            fatalError = new Error(
              `Authentication invalidated while ingesting ${video.videoId}: ${job.error}`,
            );
            return;
          }
        }
        if (classification === "auth") {
          finalRecord = recordFor(video, {
            status: "blocked",
            classification,
            attempts: attempt,
            error: message,
          });
          records.set(video.videoId, finalRecord);
          await persistReport();
          fatalError = new Error(`Authentication invalidated while ingesting ${video.videoId}: ${message}`);
          return;
        }
        if (classification === "source_unavailable" || attempt >= MAX_ATTEMPTS) {
          finalRecord = recordFor(video, {
            status: "failed",
            classification,
            attempts: attempt,
            error: message,
          });
          break;
        }
      }
    }
    if (!finalRecord) throw new Error(`No final result recorded for ${video.videoId}`);
    records.set(video.videoId, finalRecord);
    await persistReport();
  };

  const worker = async () => {
    while (!fatalError) {
      const video = orderedVideos[nextVideoIndex++];
      if (!video) return;
      try {
        await processVideo(video);
      } catch (error) {
        fatalError ??= error instanceof Error ? error : new Error(String(error));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, orderedVideos.length) }, () => worker()));
  await reportWriteTail;
  if (fatalError) throw fatalError;
  const finalReport = report();
  await writeAtomic(reportPath, finalReport);
  return finalReport;
}
