#!/usr/bin/env node
/**
 * Install or print the global Codex hook config for Farplane telemetry.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const projectHooksDir = path.join(repoRoot, ".codex");
const projectHooksPath = path.join(projectHooksDir, "hooks.json");
const globalHooksDir = path.join(os.homedir(), ".codex");
const globalHooksPath = path.join(globalHooksDir, "hooks.json");
const tsxPath = path.join(repoRoot, "node_modules/.bin/tsx");

const HOOKS = [
  {
    id: "skill-invocation-listener",
    hookType: "PostToolUse",
    matcher: "Bash|mcp__filesystem__.*|mcp__.*read.*",
    statusMessage: "Read skill MD",
    timeout: 5,
    runPath: path.join(repoRoot, "hooks/skill-invocation-listener/run.ts"),
  },
  {
    id: "file-change-listener",
    hookType: "PostToolUse",
    matcher: "Bash|apply_patch|Edit|Write|MultiEdit|mcp__filesystem__.*|mcp__.*write.*|mcp__.*edit.*",
    statusMessage: "Summarize tracked file update",
    timeout: 60,
    runPath: path.join(repoRoot, "hooks/file-change-listener/run.ts"),
  },
  {
    id: "thread-lineage-listener",
    hookType: "PostToolUse",
    matcher: "create_thread|fork_thread|codex_app.*thread|mcp__.*thread.*",
    statusMessage: "Track thread lineage",
    timeout: 5,
    runPath: path.join(repoRoot, "hooks/thread-lineage-listener/run.ts"),
  },
  {
    id: "codex-event-miner",
    hookType: "Stop",
    matcher: "",
    statusMessage: "Mine Codex events",
    timeout: 10,
    runPath: path.join(repoRoot, "hooks/codex-event-miner/run.ts"),
  },
];

function parseArgs(argv) {
  const targetArg = argv.find((arg) => arg.startsWith("--target="));
  const target = targetArg?.split("=").at(1) === "project" || argv.includes("--project") ? "project" : "global";
  return {
    write: argv.includes("--write"),
    json: argv.includes("--json"),
    target,
  };
}

function hooksPathForTarget(target) {
  return target === "project" ? projectHooksPath : globalHooksPath;
}

function hooksDirForTarget(target) {
  return target === "project" ? projectHooksDir : globalHooksDir;
}

function readExistingConfig(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`invalid_existing_hooks_json:${filePath}:${error.message}`);
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

function managedCommands() {
  return new Set(HOOKS.map((definition) => commandForEntry(buildHookEntry(definition))));
}

export function upsertFarplaneHookConfig(existing) {
  const hooks = existing && typeof existing === "object" ? { ...existing.hooks } : {};
  const entriesByType = new Map();
  for (const definition of HOOKS) {
    const current = entriesByType.get(definition.hookType) ?? [];
    current.push(buildHookEntry(definition));
    entriesByType.set(definition.hookType, current);
  }
  const nextHooks = { ...hooks };
  for (const [hookType, entries] of entriesByType.entries()) {
    const current = Array.isArray(hooks[hookType]) ? [...hooks[hookType]] : [];
    const managedCommands = new Set(entries.map(commandForEntry));
    nextHooks[hookType] = [
      ...current.filter((entry) => !managedCommands.has(commandForEntry(entry))),
      ...entries,
    ];
  }
  return {
    ...existing,
    hooks: nextHooks,
  };
}

export function pruneFarplaneHookConfig(existing) {
  const hooks = existing && typeof existing === "object" ? { ...existing.hooks } : {};
  const commands = managedCommands();
  const nextHooks = {};
  for (const [hookType, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) {
      nextHooks[hookType] = entries;
      continue;
    }
    const filteredEntries = entries
      .map((entry) => {
        const hooksList = Array.isArray(entry?.hooks) ? entry.hooks : [];
        const nextEntryHooks = hooksList.filter((hook) => !commands.has(typeof hook?.command === "string" ? hook.command : ""));
        return { ...entry, hooks: nextEntryHooks };
      })
      .filter((entry) => entry.hooks.length > 0);
    if (filteredEntries.length > 0) nextHooks[hookType] = filteredEntries;
  }
  return {
    ...existing,
    hooks: nextHooks,
  };
}

export function main() {
  const options = parseArgs(process.argv.slice(2));
  const hooksPath = hooksPathForTarget(options.target);
  const hooksDir = hooksDirForTarget(options.target);
  const existing = readExistingConfig(hooksPath);
  const next = upsertFarplaneHookConfig(existing);
  const payload = JSON.stringify(next, null, 2);
  let prunedProjectHooks = false;

  if (options.write) {
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(hooksPath, `${payload}\n`);
    if (options.target === "global" && fs.existsSync(projectHooksPath)) {
      const projectExisting = readExistingConfig(projectHooksPath);
      const pruned = pruneFarplaneHookConfig(projectExisting);
      fs.mkdirSync(projectHooksDir, { recursive: true });
      fs.writeFileSync(projectHooksPath, `${JSON.stringify(pruned, null, 2)}\n`);
      prunedProjectHooks = true;
    }
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          written: options.write,
          hooksPath,
          target: options.target,
          prunedProjectHooks,
          projectHooksPath,
          trustCommand: "/hooks",
          installedHooks: HOOKS.map(({ id, hookType, matcher, statusMessage }) => ({ id, hookType, matcher, statusMessage })),
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
  console.log("Next: open Codex /hooks and trust the changed global hooks.");
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) {
  main();
}
