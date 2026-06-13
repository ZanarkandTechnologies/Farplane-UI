#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const binDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(binDir, "..");

// Prefer a bundled CLI artifact so module-local `farplane-ui` can run without repo node_modules.
const bundledCliPath = resolve(repoRoot, "dist", "bundle", "farplane-cli.cjs");
const args = process.argv.slice(2);

if (existsSync(bundledCliPath)) {
  const child = spawn(process.execPath, [bundledCliPath, ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
} else {
  // Legacy fallback: run repo-local script (requires repo node_modules + tsx).
  const tsxPath = resolve(repoRoot, "node_modules", "tsx");
  if (!existsSync(tsxPath)) {
    console.error("farplane-ui: missing bundled CLI artifact and repo dependencies.");
    console.error(`farplane-ui: expected either ${bundledCliPath} OR ${tsxPath}`);
    console.error("farplane-ui: fix: cd " + repoRoot + " && npm install");
    console.error("farplane-ui: then: npm --prefix " + repoRoot + " run cli:bundle");
    process.exit(1);
  }

  const child = spawn("npm", ["run", "shell", "--", ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}
