#!/usr/bin/env node
/**
 * Install or print the repo-local Codex hook config for skill invocation telemetry.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const hooksDir = path.join(repoRoot, ".codex");
const hooksPath = path.join(hooksDir, "hooks.json");
const tsxPath = path.join(repoRoot, "node_modules/.bin/tsx");
const runPath = path.join(repoRoot, "hooks/skill-invocation-listener/run.ts");

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

function buildHookEntry() {
  return {
    matcher: "Bash|mcp__filesystem__.*|mcp__.*read.*",
    hooks: [
      {
        type: "command",
        command: `"${tsxPath}" "${runPath}"`,
        statusMessage: "Read skill MD",
        timeout: 5,
      },
    ],
  };
}

function upsertHookConfig(existing) {
  const hooks = existing && typeof existing === "object" ? { ...existing.hooks } : {};
  const postToolUse = Array.isArray(hooks.PostToolUse) ? [...hooks.PostToolUse] : [];
  const entry = buildHookEntry();
  const command = entry.hooks[0].command;
  const nextPostToolUse = postToolUse.filter(
    (candidate) =>
      !(
        candidate &&
        typeof candidate === "object" &&
        Array.isArray(candidate.hooks) &&
        candidate.hooks.some((hook) => hook && typeof hook === "object" && hook.command === command)
      ),
  );
  nextPostToolUse.push(entry);
  return {
    ...existing,
    hooks: {
      ...hooks,
      PostToolUse: nextPostToolUse,
    },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const existing = readExistingConfig();
  const next = upsertHookConfig(existing);
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
          config: next,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (options.write) {
    console.log(`Installed skill invocation hook config at ${hooksPath}`);
  } else {
    console.log(payload);
  }
  console.log("Next: open Codex /hooks and trust the changed repo-local hook.");
}

main();
