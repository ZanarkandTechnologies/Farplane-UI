/**
 * Foreground office startup: compose the existing analysis runtime with Vite.
 * Inputs are resolved process/probe operations; output is an exit code. Only
 * children created by this invocation are stopped, including on cancellation.
 */
export async function launchOffice({
  startRuntime, releaseRuntime, probeOffice, startVite, signIn,
  signals = process, log = console.log, error = console.error,
}) {
  const abort = new AbortController();
  let operation;
  let vite;
  let finish;
  let settled = false;
  const stopped = new Promise((resolve) => { finish = resolve; });
  const stop = (code = 0) => {
    if (settled) return;
    settled = true;
    abort.abort();
    finish(code);
  };
  const interrupt = () => stop(130);
  const terminate = () => stop(143);
  signals.once("SIGINT", interrupt);
  signals.once("SIGTERM", terminate);
  try {
    const office = await probeOffice();
    if (abort.signal.aborted) return await stopped;
    if (office === "conflict") throw new Error("Office port belongs to another service. Choose another --port.");
    if (office === "unconfigured") throw new Error("The running office has no Codex connection. Stop its old launcher and run farplane ui start again.");
    operation = await startRuntime({ signal: abort.signal });
    if (!operation.result.ready && operation.result.reason === "codex_sign_in_required" && signIn) {
      log("Codex sign-in is required. Complete sign-in to continue office startup.");
      await signIn(abort.signal);
      abort.signal.throwIfAborted();
      operation = await startRuntime({ signal: abort.signal });
    }
    if (abort.signal.aborted) return await stopped;
    if (!operation.result.ready) {
      const reason = operation.result.reason;
      throw new Error(reason === "codex_sign_in_required"
        ? "Codex sign-in is required. Run this command in an interactive terminal to sign in, or run codex login, then retry."
        : reason === "bridge_update_required"
          ? "The running YouTube bridge predates authentication checks. Stop its old launcher, then run farplane ui start again."
          : `Analysis services could not start (${reason ?? "unknown"}). Run farplane extension youtube doctor.`);
    }
    log(`Codex and YouTube analysis: ready (${operation.result.outcome}).`);
    for (const { child, kind } of operation.ownedChildren) {
      child.once("error", (cause) => { error(`${kind} failed: ${cause.message}`); stop(1); });
      child.once("exit", () => { if (!settled) error(`${kind} stopped; closing this office launch.`); stop(1); });
      if (child.exitCode != null || child.signalCode != null) stop(1);
    }
    if (abort.signal.aborted) return await stopped;
    if (office === "ready") {
      log("Office already running; reusing it.");
      if (operation.ownedChildren.length === 0) return 0;
    } else {
      vite = startVite();
      vite.once("error", (cause) => { error(`Office failed: ${cause.message}`); stop(1); });
      vite.once("exit", (code) => stop(code ?? 1));
    }
    log("Press Ctrl+C to stop services started by this command.");
    return await stopped;
  } catch (cause) {
    if (abort.signal.aborted && settled) return await stopped;
    error(`farplane-ui: ${cause instanceof Error ? cause.message : String(cause)}`);
    return 1;
  } finally {
    abort.abort();
    if (vite && vite.exitCode == null && vite.signalCode == null) vite.kill("SIGTERM");
    if (operation) await releaseRuntime(operation);
    signals.removeListener("SIGINT", interrupt);
    signals.removeListener("SIGTERM", terminate);
  }
}
