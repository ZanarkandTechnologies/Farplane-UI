/**
 * Launches the UI-owned Vite binary from the UI workspace.
 * Inputs are CLI flags passed after `pnpm run ui --`; output and signals are
 * inherited by the caller. This avoids npm/pnpm argument and hoisting differences.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = path.join(repoRoot, "ui");
const requireFromUi = createRequire(path.join(uiRoot, "package.json"));
const vitePackagePath = requireFromUi.resolve("vite/package.json");
const viteBinPath = path.join(path.dirname(vitePackagePath), "bin", "vite.js");
const forwardedArgs = process.argv.slice(2);
if (forwardedArgs[0] === "--") forwardedArgs.shift();
const child = spawn(
  process.execPath,
  [viteBinPath, "--config", "vite.config.ts", ...forwardedArgs],
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
