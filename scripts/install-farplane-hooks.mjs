#!/usr/bin/env node
/**
 * Install or print the repo-local Codex hook config for Farplane telemetry.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const hooksDir = path.join(repoRoot, ".codex");
const hooksPath = path.join(hooksDir, "hooks.json");
const tsxPath = path.join(repoRoot, "node_modules/.bin/tsx");

const HOOKS = [
  {
    id: "skill-invocation-listener",
    matcher: "Bash|mcp__filesystem__.*|mcp__.*read.*",
    statusMessage: "Read skill MD",
    timeout: 5,
    runPath: path.join(repoRoot, "hooks/skill-invocation-listener/run.ts"),
  },
  {
    id: "file-change-listener",
    matcher: "Bash|apply_patch|Edit|Write|MultiEdit|mcp__filesystem__.*|mcp__.*write.*|mcp__.*edit.*",
    statusMessage: "Summarize tracked file update",
    timeout: 60,
    runPath: path.join(repoRoot, "hooks/file-change-listener/run.ts"),
  },
];

function parseArgs(argv) {
  return {
    write: argv.includes("--write"),
    json: argv.includes("--json"),
  };
}

function readExistingConfig() {
  if (!fs.existsSync(hooksPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  } catch (error) {
    throw new Error(`invalid_existing_hooks_json:${hooksPath}:${error.message}`);
  }
}

function buildHookEntry(definition) {
  return {
    matcher: definition.matcher,
    hooks: [
      {
        type: "command",
        command: `"${tsxPath}" "${definition.runPath}"`,
        statusMessage: definition.statusMessage,
        timeout: definition.timeout,
      },
    ],
  };
}

function commandForEntry(entry) {
  const hook = Array.isArray(entry?.hooks) ? entry.hooks[0] : undefined;
  return typeof hook?.command === "string" ? hook.command : "";
}

export function upsertFarplaneHookConfig(existing) {
  const hooks = existing && typeof existing === "object" ? { ...existing.hooks } : {};
  const postToolUse = Array.isArray(hooks.PostToolUse) ? [...hooks.PostToolUse] : [];
  const entries = HOOKS.map(buildHookEntry);
  const managedCommands = new Set(entries.map(commandForEntry));
  return {
    ...existing,
    hooks: {
      ...hooks,
      PostToolUse: [
        ...postToolUse.filter((entry) => !managedCommands.has(commandForEntry(entry))),
        ...entries,
      ],
    },
  };
}

export function main() {
  const options = parseArgs(process.argv.slice(2));
  const existing = readExistingConfig();
  const next = upsertFarplaneHookConfig(existing);
  const payload = JSON.stringify(next, null, 2);

  if (options.write) {
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(hooksPath, `${payload}\n`);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          written: options.write,
          hooksPath,
          trustCommand: "/hooks",
          installedHooks: HOOKS.map(({ id, matcher, statusMessage }) => ({ id, matcher, statusMessage })),
          config: next,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (options.write) {
    console.log(`Installed Farplane hook telemetry config at ${hooksPath}`);
  } else {
    console.log(payload);
  }
  console.log("Next: open Codex /hooks and trust the changed repo-local hooks.");
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) {
  main();
}
