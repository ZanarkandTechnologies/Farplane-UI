#!/usr/bin/env node
/**
 * Farplane UI hook installer adapter.
 *
 * Core owns Codex hook installation, command health, and local mining
 * semantics. This script preserves the UI/npm entrypoint while delegating to
 * the fixed Core CLI verbs instead of writing TypeScript hook commands.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

export function parseArgs(argv) {
  const targetArg = argv.find((arg) => arg.startsWith("--target="));
  const explicitTarget = targetArg?.split("=").at(1);
  return {
    write: argv.includes("--write"),
    json: argv.includes("--json"),
    target: explicitTarget === "global" || argv.includes("--global") ? "global" : "project",
  };
}

export function coreHookArgs(options) {
  const args = ["hooks", options.write ? "install" : "list"];
  if (options.target === "global") {
    args.push("--target", path.join(process.env.HOME ?? "", ".codex"));
  } else {
    args.push("--target", path.join(repoRoot, ".codex"));
  }
  if (options.json) args.push("--json");
  return args;
}

export function runCoreHooks(options, env = process.env) {
  const command = env.FARPLANE_CORE_CLI || "farplane";
  const args = coreHookArgs(options);
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });
}

export function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = runCoreHooks(options);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    const payload = {
      ok: false,
      summary: "Farplane Core CLI is required for hook installation",
      command: process.env.FARPLANE_CORE_CLI || "farplane",
      args: coreHookArgs(options),
      error: result.error.message,
      hints: ["Install Farplane Core or set FARPLANE_CORE_CLI=/path/to/Farplane/bin/farplane.py"],
    };
    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.error(`farplane-ui hooks adapter failed: ${payload.error}`);
      console.error(payload.hints[0]);
    }
    process.exitCode = 127;
    return;
  }
  process.exitCode = result.status ?? 0;
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) {
  main();
}
