/**
 * Farplane runtime config resolver.
 *
 * Inputs: ~/.farplane/config.toml and shell env.
 * Outputs: local runtime setting values for CLI, hooks, and scripts.
 * Side effects: read-only filesystem access.
 */

import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

type JsonObject = Record<string, unknown>;

export function resolveFarplaneHome(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.FARPLANE_STATE_DIR?.trim() ||
    env.FARPLANE_HOME?.trim() ||
    path.join(os.homedir(), ".farplane")
  );
}

function stripTomlComment(line: string): string {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quoted) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "#" && !quoted) return line.slice(0, index).trimEnd();
  }
  return line.trimEnd();
}

function parseTomlValue(rawValue: string): unknown {
  const value = rawValue.trim();
  if (!value) return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === "string" ? parsed.trim() : "";
    } catch {
      return value.slice(1, -1).trim();
    }
  }
  return value.trim();
}

function readTomlObject(filePath: string): JsonObject {
  let current: JsonObject | null = null;
  const root: JsonObject = {};
  try {
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = stripTomlComment(rawLine).trim();
      if (!line) continue;
      const sectionMatch = line.match(/^\[([A-Za-z0-9_.-]+)\]$/);
      if (sectionMatch) {
        current = root;
        for (const part of sectionMatch[1].split(".")) {
          const child = current[part];
          if (!child || typeof child !== "object" || Array.isArray(child)) current[part] = {};
          current = current[part] as JsonObject;
        }
        continue;
      }
      const assignmentMatch = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.*)$/);
      if (!assignmentMatch || !current) continue;
      current[assignmentMatch[1]] = parseTomlValue(assignmentMatch[2]);
    }
  } catch {
    return {};
  }
  return root;
}

function objectStringAt(row: JsonObject, pathParts: string[]): string {
  let current: unknown = row;
  for (const part of pathParts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return "";
    current = (current as JsonObject)[part];
  }
  return typeof current === "string" ? current.trim() : "";
}

function objectValueAt(row: JsonObject, pathParts: string[]): unknown {
  let current: unknown = row;
  for (const part of pathParts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as JsonObject)[part];
  }
  return current;
}

export function readFarplaneConfigValue(
  name: string,
  options: { env?: NodeJS.ProcessEnv; secret?: boolean } = {},
): string {
  const env = options.env ?? process.env;
  if (options.secret) return env[name]?.trim() || "";
  const hasExplicitStateRoot = Boolean(env.FARPLANE_STATE_DIR?.trim() || env.FARPLANE_HOME?.trim());
  const shouldReadLocalFiles = !options.env || env === process.env || hasExplicitStateRoot;
  const saved = shouldReadLocalFiles
    ? (() => {
        const farplaneHome = resolveFarplaneHome(env);
        const config = readTomlObject(path.join(farplaneHome, "config.toml"));
        return objectStringAt(config, ["env", name]);
      })()
    : "";
  return saved || env[name]?.trim() || "";
}

export function readFarplaneConfigObject(
  pathParts: string[],
  options: { env?: NodeJS.ProcessEnv } = {},
): unknown {
  const env = options.env ?? process.env;
  const hasExplicitStateRoot = Boolean(env.FARPLANE_STATE_DIR?.trim() || env.FARPLANE_HOME?.trim());
  const shouldReadLocalFiles = !options.env || env === process.env || hasExplicitStateRoot;
  if (!shouldReadLocalFiles) return undefined;
  const farplaneHome = resolveFarplaneHome(env);
  const config = readTomlObject(path.join(farplaneHome, "config.toml"));
  return objectValueAt(config, pathParts);
}

export function readFarplaneConfigFileObject(filePath: string, pathParts: string[]): unknown {
  return objectValueAt(readTomlObject(filePath), pathParts);
}

export function firstFarplaneConfigValue(
  names: string[],
  options: { env?: NodeJS.ProcessEnv; secret?: boolean } = {},
): string {
  for (const name of names) {
    const value = readFarplaneConfigValue(name, options);
    if (value) return value;
  }
  return "";
}
