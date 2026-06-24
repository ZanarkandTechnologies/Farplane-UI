/**
 * Farplane runtime config resolver.
 *
 * Inputs: ~/.farplane/config.json, ~/.farplane/secrets.json, and shell env.
 * Outputs: local runtime setting values for CLI, hooks, and scripts.
 * Side effects: read-only filesystem access.
 */

import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

type JsonObject = Record<string, unknown>;

export function resolveFarplaneHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.FARPLANE_STATE_DIR?.trim() || env.FARPLANE_HOME?.trim() || path.join(os.homedir(), ".farplane");
}

function readJsonObject(filePath: string): JsonObject {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {};
  } catch {
    return {};
  }
}

function objectStringAt(row: JsonObject, pathParts: string[]): string {
  let current: unknown = row;
  for (const part of pathParts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return "";
    current = (current as JsonObject)[part];
  }
  return typeof current === "string" ? current.trim() : "";
}

export function readFarplaneConfigValue(
  name: string,
  options: { env?: NodeJS.ProcessEnv; secret?: boolean } = {},
): string {
  const env = options.env ?? process.env;
  const hasExplicitStateRoot = Boolean(env.FARPLANE_STATE_DIR?.trim() || env.FARPLANE_HOME?.trim());
  const shouldReadLocalFiles = !options.env || env === process.env || hasExplicitStateRoot;
  const saved = shouldReadLocalFiles
    ? (() => {
        const farplaneHome = resolveFarplaneHome(env);
        const config = readJsonObject(path.join(farplaneHome, "config.json"));
        const secrets = readJsonObject(path.join(farplaneHome, "secrets.json"));
        return options.secret
          ? objectStringAt(secrets, ["env", name])
          : objectStringAt(config, ["env", name]);
      })()
    : "";
  return saved || env[name]?.trim() || "";
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
