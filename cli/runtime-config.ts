/**
 * Farplane runtime config resolver.
 *
 * Inputs: ~/.farplane/config.toml and shell env.
 * Outputs: local runtime setting values for CLI, hooks, and scripts.
 * Side effects: read-only filesystem access.
 */

import os from "node:os";
import path from "node:path";
import {
  operatorSettingsAt,
  readOperatorSettingsTomlFile,
  type OperatorSettingsObject,
} from "./operator-settings.js";

type JsonObject = OperatorSettingsObject;

export function resolveFarplaneHome(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.FARPLANE_STATE_DIR?.trim() ||
    env.FARPLANE_HOME?.trim() ||
    path.join(os.homedir(), ".farplane")
  );
}

function readTomlObject(filePath: string): JsonObject {
  return readOperatorSettingsTomlFile(filePath);
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
  return operatorSettingsAt(row, pathParts);
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
