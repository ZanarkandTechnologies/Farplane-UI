/**
 * YouTube extension runtime command presentation.
 *
 * Inputs: operator action and output mode.
 * Outputs: concise text or JSON lifecycle receipts.
 * Side effects: delegates runtime ownership to the focused lifecycle module.
 */

import type { Command } from "commander";
import {
  YOUTUBE_LOCAL_HOST,
  YOUTUBE_START_COMMAND,
} from "../apps/youtube-shortcut/local-runtime.js";
import { cliSection, cliStatus, formatOutput, type OutputMode } from "./cli-utils.js";
import {
  inspectYoutubeExtensionRuntime,
  keepYoutubeRuntimeForeground,
  startYoutubeExtensionRuntime,
  stopYoutubeExtensionRuntime,
} from "./youtube-extension-runtime.js";
import type {
  YoutubeRuntimeInspection,
  YoutubeStartResult,
  YoutubeStopResult,
} from "./youtube-extension-runtime-contract.js";

export {
  createYoutubeRuntimeStore,
  probeYoutubeBridge,
  resolveYoutubeRuntimeRecordPath,
} from "./youtube-extension-runtime-contract.js";
export type {
  ResolvedYoutubeRuntimeDependencies,
  YoutubeBridgeHealth,
  YoutubeBridgeProbe,
  YoutubeOwnedChild,
  YoutubeRuntimeDependencies,
  YoutubeRuntimeRecord,
  YoutubeRuntimeStore,
  YoutubeStartOperation,
} from "./youtube-extension-runtime-contract.js";
export {
  inspectYoutubeExtensionRuntime,
  keepYoutubeRuntimeForeground,
  startYoutubeExtensionRuntime,
  stopYoutubeExtensionRuntime,
} from "./youtube-extension-runtime.js";
export type {
  YoutubeRuntimeInspection,
  YoutubeStartResult,
  YoutubeStopResult,
} from "./youtube-extension-runtime-contract.js";

function startText(result: YoutubeStartResult): string {
  if (result.outcome === "conflict")
    return [
      cliSection("Farplane YouTube runtime"),
      `${cliStatus("!", "warn")} The bridge could not be started safely (${result.reason ?? "unknown"}).`,
      `Nothing was stopped. Run ${YOUTUBE_START_COMMAND.replace(" start", " doctor")}.`,
    ].join("\n");
  return [
    cliSection("Farplane YouTube runtime"),
    `${cliStatus("✓", "ok")} Codex app-server  ${result.appServer.state}  · ${YOUTUBE_LOCAL_HOST}:${result.appServer.port}`,
    `${cliStatus("✓", "ok")} YouTube bridge    ${result.bridge.state}  · ready`,
    "",
    result.outcome === "started"
      ? "Open YouTube and use Analyze. Press Ctrl+C to stop services started by this command."
      : "Open YouTube and use Analyze.",
  ].join("\n");
}

function inspectionText(result: YoutubeRuntimeInspection): string {
  const issues = result.issues?.length ? `\nIssues: ${result.issues.join(", ")}` : "";
  return (
    [
      cliSection(`Farplane YouTube ${result.action}`),
      `Bridge: ${result.bridge.state} · ${YOUTUBE_LOCAL_HOST}:${result.bridge.port}${result.bridge.pid ? ` · pid ${result.bridge.pid}` : ""}`,
      `Codex app-server: ${result.appServer.state} · ${YOUTUBE_LOCAL_HOST}:${result.appServer.port}`,
      `Runtime record: ${result.runtimeRecord.state}${result.runtimeRecord.bridgePid ? ` · bridge pid ${result.runtimeRecord.bridgePid}` : ""}`,
    ].join("\n") + issues
  );
}

function stopText(result: YoutubeStopResult): string {
  if (result.outcome === "stopped")
    return "Stopped the Farplane-owned YouTube bridge. The Codex app-server was retained.";
  return `YouTube bridge was not stopped (${result.outcome}${result.reason ? `: ${result.reason}` : ""}).`;
}

export function registerYoutubeExtensionCommands(program: Command): void {
  const extension = program
    .command("extension")
    .description("Manage local Farplane browser extensions");
  extension
    .command("youtube <action>")
    .description("Start, inspect, diagnose, or safely stop the YouTube extension runtime")
    .option("--json", "Output JSON", false)
    .action(async (action: string, options: { json?: boolean }) => {
      const outputMode: OutputMode = options.json ? "json" : "text";
      if (action === "start") {
        const operation = await startYoutubeExtensionRuntime();
        formatOutput(outputMode, operation.result, startText(operation.result));
        if (operation.result.outcome === "conflict") process.exitCode = 1;
        else await keepYoutubeRuntimeForeground(operation);
        return;
      }
      if (action === "status" || action === "doctor") {
        const inspection = await inspectYoutubeExtensionRuntime(action);
        formatOutput(outputMode, inspection, inspectionText(inspection));
        if (action === "doctor" && !inspection.ready) process.exitCode = 1;
        return;
      }
      if (action === "stop") {
        const stopped = await stopYoutubeExtensionRuntime();
        formatOutput(outputMode, stopped, stopText(stopped));
        if (stopped.outcome !== "stopped" && stopped.outcome !== "not_running")
          process.exitCode = 1;
        return;
      }
      throw new Error(`invalid_youtube_extension_action:${action}:use_start_status_doctor_or_stop`);
    });
}
