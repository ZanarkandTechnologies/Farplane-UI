/**
 * YouTube extension process lifecycle.
 *
 * Inputs: resolved runtime dependencies and bridge health state.
 * Outputs: start, inspect, stop, and foreground-lifecycle receipts.
 * Side effects: spawns only missing local processes and signals only owned or
 * token-verified bridge processes.
 */

import {
  YOUTUBE_APP_SERVER_PORT,
  YOUTUBE_APP_SERVER_URL,
  YOUTUBE_BRIDGE_PORT,
  YOUTUBE_RUNTIME_NAME,
} from "../apps/youtube-shortcut/local-runtime.js";
import {
  resolveYoutubeRuntimeDependencies,
  YOUTUBE_START_RETRY_DELAY_MS,
  type ResolvedYoutubeRuntimeDependencies,
  type YoutubeBridgeHealth,
  type YoutubeOwnedChild,
  type YoutubeRuntimeDependencies,
  type YoutubeRuntimeInspection,
  type YoutubeRuntimeRecord,
  type YoutubeRuntimeStore,
  type YoutubeStartOperation,
  type YoutubeStopResult,
} from "./youtube-extension-runtime-contract.js";

function startChild(
  deps: ResolvedYoutubeRuntimeDependencies,
  kind: YoutubeOwnedChild["kind"],
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): YoutubeOwnedChild {
  return {
    kind,
    child: deps.spawnProcess(command, args, {
      cwd: deps.repoRoot,
      env,
      stdio: "inherit",
      detached: process.platform !== "win32",
    }),
  };
}

function monitorChild(child: YoutubeOwnedChild["child"], label: string): () => Error | undefined {
  let failure: Error | undefined;
  child.once("error", (error) => {
    failure = new Error(`${label}_failed:${error.message}`);
  });
  child.once("exit", (code, signal) => {
    if (!failure) failure = new Error(`${label}_exited:${signal ?? code ?? "unknown"}`);
  });
  return () => failure;
}

async function waitForOwnedBridge(
  deps: ResolvedYoutubeRuntimeDependencies,
  bridgeFailure: () => Error | undefined,
): Promise<YoutubeBridgeHealth> {
  const deadline = deps.now() + deps.startTimeoutMs;
  while (deps.now() <= deadline) {
    const failure = bridgeFailure();
    if (failure) throw failure;
    const probe = await deps.probeBridge();
    if (probe.state === "ready") return probe.health;
    if (probe.state === "conflict") throw new Error(`bridge_${probe.reason}`);
    await deps.sleep(YOUTUBE_START_RETRY_DELAY_MS);
  }
  throw new Error("bridge_readiness_timeout");
}

function safeReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "runtime_start_failed";
  return message.replace(/[^a-zA-Z0-9_:-]/g, "_").slice(0, 160);
}

async function terminateOwnedChildren(
  children: YoutubeOwnedChild[],
  deps: ResolvedYoutubeRuntimeDependencies,
): Promise<void> {
  for (const { child } of [...children].reverse()) {
    if (!child.pid) continue;
    try {
      if (process.platform !== "win32") deps.signalProcess(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {
        // The child has already exited; it remains safe to continue cleanup.
      }
    }
  }
}

async function removeMatchingRecord(
  record: YoutubeRuntimeRecord | undefined,
  store: YoutubeRuntimeStore,
): Promise<void> {
  if (!record) return;
  try {
    const current = await store.read();
    if (current?.runtimeToken === record.runtimeToken && current.bridgePid === record.bridgePid)
      await store.remove();
  } catch {
    // Runtime cleanup never deletes an unreadable or replaced record.
  }
}

export async function startYoutubeExtensionRuntime(
  options: YoutubeRuntimeDependencies = {},
): Promise<YoutubeStartOperation> {
  const deps = resolveYoutubeRuntimeDependencies(options);
  const initial = await deps.probeBridge();
  if (initial.state === "ready") {
    return {
      result: {
        action: "start",
        outcome: "attached",
        ready: true,
        bridge: { port: YOUTUBE_BRIDGE_PORT, state: "attached" },
        appServer: { port: YOUTUBE_APP_SERVER_PORT, state: "attached" },
      },
      ownedChildren: [],
    };
  }
  if (initial.state === "unready") {
    return {
      result: {
        action: "start",
        outcome: "conflict",
        ready: false,
        bridge: { port: YOUTUBE_BRIDGE_PORT, state: "conflict" },
        appServer: { port: YOUTUBE_APP_SERVER_PORT, state: "unavailable" },
        reason: "bridge_unready",
      },
      ownedChildren: [],
    };
  }
  if (initial.state === "conflict") {
    return {
      result: {
        action: "start",
        outcome: "conflict",
        ready: false,
        bridge: { port: YOUTUBE_BRIDGE_PORT, state: "conflict" },
        appServer: { port: YOUTUBE_APP_SERVER_PORT, state: "unavailable" },
        reason: `bridge_${initial.reason}`,
      },
      ownedChildren: [],
    };
  }

  const ownedChildren: YoutubeOwnedChild[] = [];
  const appServerPresent = await deps.isAppServerListening();
  try {
    if (!appServerPresent) {
      ownedChildren.push(
        startChild(
          deps,
          "app-server",
          "codex",
          ["app-server", "--listen", YOUTUBE_APP_SERVER_URL],
          process.env,
        ),
      );
    }
    const token = deps.randomToken();
    const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const bridge = startChild(
      deps,
      "bridge",
      pnpm,
      ["--filter", "@farplane/youtube-shortcut", "exec", "tsx", "scripts/local-agent.ts"],
      { ...process.env, FARPLANE_YOUTUBE_RUNTIME_TOKEN: token },
    );
    ownedChildren.push(bridge);
    const bridgeFailure = monitorChild(bridge.child, "youtube_bridge");
    await waitForOwnedBridge(deps, bridgeFailure);
    const identified = await deps.probeBridge(token);
    if (
      identified.state !== "ready" ||
      identified.health.runtime !== YOUTUBE_RUNTIME_NAME ||
      identified.health.runtimeToken !== token
    )
      throw new Error("bridge_identity_unverified");
    const bridgePid = await deps.findListeningPid(YOUTUBE_BRIDGE_PORT);
    if (!bridgePid) throw new Error("bridge_listener_pid_unavailable");
    const record: YoutubeRuntimeRecord = {
      schemaVersion: 1,
      bridgePid,
      runtimeToken: token,
      startedAt: new Date(deps.now()).toISOString(),
    };
    await deps.runtimeStore.write(record);
    return {
      result: {
        action: "start",
        outcome: "started",
        ready: true,
        bridge: { port: YOUTUBE_BRIDGE_PORT, state: "started" },
        appServer: {
          port: YOUTUBE_APP_SERVER_PORT,
          state: appServerPresent ? "attached" : "started",
        },
      },
      ownedChildren,
      runtimeRecord: record,
    };
  } catch (error) {
    await terminateOwnedChildren(ownedChildren, deps);
    return {
      result: {
        action: "start",
        outcome: "conflict",
        ready: false,
        bridge: { port: YOUTUBE_BRIDGE_PORT, state: "conflict" },
        appServer: {
          port: YOUTUBE_APP_SERVER_PORT,
          state: appServerPresent ? "attached" : "unavailable",
        },
        reason: safeReason(error),
      },
      ownedChildren: [],
    };
  }
}

export async function inspectYoutubeExtensionRuntime(
  action: "status" | "doctor" = "status",
  options: YoutubeRuntimeDependencies = {},
): Promise<YoutubeRuntimeInspection> {
  const deps = resolveYoutubeRuntimeDependencies(options);
  const bridge = await deps.probeBridge();
  const pid =
    bridge.state === "absent"
      ? undefined
      : await deps.findListeningPid(YOUTUBE_BRIDGE_PORT).catch(() => undefined);
  let record: YoutubeRuntimeRecord | undefined;
  let invalidRecord = false;
  try {
    record = await deps.runtimeStore.read();
  } catch {
    invalidRecord = true;
  }
  const appServerState: YoutubeRuntimeInspection["appServer"]["state"] =
    bridge.state === "ready"
      ? "ready"
      : await deps
          .isAppServerListening()
          .then((listening) => (listening ? "listening" : "absent"))
          .catch(() => "unknown");
  const inspection: YoutubeRuntimeInspection = {
    action,
    ready: bridge.state === "ready",
    bridge: { port: YOUTUBE_BRIDGE_PORT, state: bridge.state, ...(pid ? { pid } : {}) },
    appServer: { port: YOUTUBE_APP_SERVER_PORT, state: appServerState },
    runtimeRecord: invalidRecord
      ? { state: "invalid" }
      : record
        ? { state: "present", bridgePid: record.bridgePid }
        : { state: "absent" },
  };
  if (action === "doctor") {
    inspection.issues = [
      ...(bridge.state === "absent" ? ["bridge_not_running"] : []),
      ...(bridge.state === "unready" ? ["bridge_not_ready"] : []),
      ...(bridge.state === "conflict" ? ["bridge_conflict"] : []),
      ...(appServerState === "absent" ? ["app_server_not_listening"] : []),
      ...(invalidRecord ? ["runtime_record_invalid"] : []),
      ...(record && pid !== record.bridgePid ? ["runtime_record_pid_mismatch"] : []),
    ];
  }
  return inspection;
}

export async function stopYoutubeExtensionRuntime(
  options: YoutubeRuntimeDependencies = {},
): Promise<YoutubeStopResult> {
  const deps = resolveYoutubeRuntimeDependencies(options);
  let record: YoutubeRuntimeRecord | undefined;
  try {
    record = await deps.runtimeStore.read();
  } catch {
    return {
      action: "stop",
      outcome: "not_managed",
      bridge: { port: YOUTUBE_BRIDGE_PORT },
      reason: "runtime_record_invalid",
    };
  }
  if (!record)
    return { action: "stop", outcome: "not_managed", bridge: { port: YOUTUBE_BRIDGE_PORT } };
  const listenerPid = await deps.findListeningPid(YOUTUBE_BRIDGE_PORT).catch(() => undefined);
  if (!listenerPid)
    return { action: "stop", outcome: "not_running", bridge: { port: YOUTUBE_BRIDGE_PORT } };
  if (listenerPid !== record.bridgePid)
    return {
      action: "stop",
      outcome: "identity_mismatch",
      bridge: { port: YOUTUBE_BRIDGE_PORT, pid: listenerPid },
      reason: "listener_pid_mismatch",
    };
  const probe = await deps.probeBridge(record.runtimeToken);
  if (
    (probe.state !== "ready" && probe.state !== "unready") ||
    probe.health.runtimeToken !== record.runtimeToken
  )
    return {
      action: "stop",
      outcome: "identity_mismatch",
      bridge: { port: YOUTUBE_BRIDGE_PORT, pid: listenerPid },
      reason: "runtime_token_mismatch",
    };
  const finalPid = await deps.findListeningPid(YOUTUBE_BRIDGE_PORT).catch(() => undefined);
  if (finalPid !== record.bridgePid)
    return {
      action: "stop",
      outcome: "identity_mismatch",
      bridge: { port: YOUTUBE_BRIDGE_PORT, pid: finalPid },
      reason: "listener_changed",
    };
  try {
    deps.signalProcess(finalPid, "SIGTERM");
    await deps.runtimeStore.remove();
    return {
      action: "stop",
      outcome: "stopped",
      bridge: { port: YOUTUBE_BRIDGE_PORT, pid: finalPid },
    };
  } catch {
    return {
      action: "stop",
      outcome: "failed",
      bridge: { port: YOUTUBE_BRIDGE_PORT, pid: finalPid },
      reason: "signal_failed",
    };
  }
}

export async function keepYoutubeRuntimeForeground(
  operation: YoutubeStartOperation,
  options: YoutubeRuntimeDependencies = {},
): Promise<void> {
  if (operation.ownedChildren.length === 0) return;
  const deps = resolveYoutubeRuntimeDependencies(options);
  await new Promise<void>((resolvePromise) => {
    let closing = false;
    const finish = () => {
      process.removeListener("SIGINT", shutdown);
      process.removeListener("SIGTERM", shutdown);
      resolvePromise();
    };
    const shutdown = () => {
      if (closing) return;
      closing = true;
      void terminateOwnedChildren(operation.ownedChildren, deps)
        .then(() => removeMatchingRecord(operation.runtimeRecord, deps.runtimeStore))
        .finally(finish);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    for (const { child } of operation.ownedChildren) child.once("exit", shutdown);
  });
}
