/**
 * Launches the UI-owned Vite binary from the UI workspace.
 * Inputs are CLI flags passed after `pnpm run ui --`; output and signals are
 * inherited by the caller. This avoids npm/pnpm argument and hoisting differences.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = path.join(repoRoot, "ui");
const requireFromUi = createRequire(path.join(uiRoot, "package.json"));
const vitePackagePath = requireFromUi.resolve("vite/package.json");
const viteBinPath = path.join(path.dirname(vitePackagePath), "bin", "vite.js");
const forwardedArgs = process.argv.slice(2);
if (forwardedArgs[0] === "--") forwardedArgs.shift();

function resolvePort(args) {
  const portArgIndex = args.findIndex((argument) => argument === "--port");
  const rawPort =
    portArgIndex >= 0
      ? args[portArgIndex + 1]
      : args.find((argument) => argument.startsWith("--port="))?.slice("--port=".length);
  const port = Number(rawPort ?? 5173);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : 5173;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

const port = resolvePort(forwardedArgs);
if (!(await isPortAvailable(port))) {
  console.error(`farplane-ui: http://127.0.0.1:${port} is already running; reuse it or stop it first.`);
  process.exitCode = 1;
} else {
  const optimizerArgs = forwardedArgs.includes("--force") ? [] : ["--force"];
  const child = spawn(
    process.execPath,
    [viteBinPath, "--config", "vite.config.ts", ...optimizerArgs, ...forwardedArgs],
    {
      cwd: uiRoot,
      env: process.env,
      stdio: "inherit",
    },
  );

  child.on("error", (error) => {
    console.error(`farplane-ui: failed to start Vite: ${error.message}`);
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}
