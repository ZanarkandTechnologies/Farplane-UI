/**
 * UI COMMANDS
 * ===========
 * Purpose
 * - Provide a Farplane-native alias for starting the UI dev server.
 *
 * KEY CONCEPTS:
 * - Farplane CLI stays the primary operator entrypoint.
 * - The UI command calls the same package-manager-neutral launcher as the root script.
 *
 * USAGE:
 * - farplane ui
 *
 * MEMORY REFERENCES:
 * - MEM-0162
 * - MEM-0164
 */

import { spawn } from "node:child_process";
import path from "node:path";
import type { Command } from "commander";
import { cliBlue, cliDim, cliSection } from "./cli-utils.js";
import { resolveFarplaneUiRepoRoot } from "./repo-root.js";

/** Resolve the checkout root from either source (`cli/`) or bundled (`dist/bundle/`) execution. */
function resolveRepoRoot(): string {
  return resolveFarplaneUiRepoRoot(import.meta.url);
}

type StartUiDevServerOptions = {
  args?: readonly string[];
  cwd?: string;
  propagateSignal?: boolean;
};

export async function startUiDevServer(options: StartUiDevServerOptions = {}): Promise<void> {
  const cwd = options.cwd ?? resolveRepoRoot();
  const propagateSignal = options.propagateSignal !== false;
  const baseOpts = { cwd, stdio: "inherit" as const, env: process.env };
  const launcherPath = path.join(cwd, "scripts", "run-ui.mjs");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [launcherPath, ...(options.args ?? [])], baseOpts);

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        if (propagateSignal) {
          process.kill(process.pid, signal);
          return;
        }
        resolve();
        return;
      }
      if ((code ?? 1) !== 0) {
        reject(new Error(`ui_command_failed:${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

export function registerUiCommands(program: Command): void {
  program
    .command("ui [viteArgs...]")
    .description("Start the office with Codex and YouTube analysis services")
    .action(async (viteArgs: string[] = []) => {
      console.log(cliSection("Farplane UI"));
      console.log(cliDim("Starting the office and checking its local analysis services."));
      console.log(cliBlue("Stop it with Ctrl+C. You can rerun this command any time."));
      console.log("");
      await startUiDevServer({ args: viteArgs });
    });
}
