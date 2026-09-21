/**
 * Owns the browser-local cache of bridge-validated project options.
 *
 * Inputs: project IDs/names returned by the origin-restricted loopback bridge.
 * Outputs: one schema-checked cache record shared by the popup and YouTube UI.
 * Side effects: reads and writes the extension's existing storage permission.
 * The cache is an availability aid only; the popup remains the explicit refresh
 * surface and the bridge still resolves the selected project server-side.
 */
import type { ProjectOption } from "./runtime-protocol.js";

export const PROJECT_OPTIONS_CACHE_KEY = "farplane-youtube-project-options-v1";

export type ProjectOptionsCache = {
  projects: ProjectOption[];
  syncedAtMs: number;
};

export type ProjectOptionsStorage = Pick<
  chrome.storage.StorageArea,
  "get" | "set"
>;

function normalizeProjectOptions(value: unknown): ProjectOption[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const projects: ProjectOption[] = [];
  for (const valueItem of value) {
    if (typeof valueItem !== "object" || valueItem === null) return null;
    const item = valueItem as { id?: unknown; name?: unknown };
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!id || !name || seen.has(id)) return null;
    seen.add(id);
    projects.push({ id, name });
  }
  return projects.sort((left, right) => left.name.localeCompare(right.name));
}

export function createProjectOptionsCache(
  projects: unknown,
  syncedAtMs = Date.now(),
): ProjectOptionsCache {
  const normalizedProjects = normalizeProjectOptions(projects);
  if (!normalizedProjects || !Number.isFinite(syncedAtMs) || syncedAtMs <= 0) {
    throw new Error("Project sync returned invalid options");
  }
  return { projects: normalizedProjects, syncedAtMs };
}

export function parseProjectOptionsCache(value: unknown): ProjectOptionsCache | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as { projects?: unknown; syncedAtMs?: unknown };
  if (typeof record.syncedAtMs !== "number") return null;
  try {
    return createProjectOptionsCache(record.projects, record.syncedAtMs);
  } catch {
    return null;
  }
}

export async function readProjectOptionsCache(
  storage: ProjectOptionsStorage = chrome.storage.local,
): Promise<ProjectOptionsCache | null> {
  const record = await storage.get(PROJECT_OPTIONS_CACHE_KEY);
  return parseProjectOptionsCache(record[PROJECT_OPTIONS_CACHE_KEY]);
}

export async function writeProjectOptionsCache(
  projects: unknown,
  storage: ProjectOptionsStorage = chrome.storage.local,
  syncedAtMs = Date.now(),
): Promise<ProjectOptionsCache> {
  const cache = createProjectOptionsCache(projects, syncedAtMs);
  await storage.set({ [PROJECT_OPTIONS_CACHE_KEY]: cache });
  return cache;
}
