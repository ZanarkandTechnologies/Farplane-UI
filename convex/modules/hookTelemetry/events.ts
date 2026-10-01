// Compatibility entrypoint: hook rows now land in the telemetry module's `events` table (source `hook`).
// Keep `internal.modules.hookTelemetry.events.*` stable for any caller that still names this path.
export { ingestHookTelemetry, ingestHookTelemetryBatch } from "../telemetry/ingest";
