/**
 * Owns the tracked project-local agent profile contract.
 * Reads `farplane/agents.yaml`, validates browser-facing profile data, and returns
 * side-effect-free profile rows. Portraits remain safe project-relative refs for
 * the HTTP bridge to translate into absolute browser URLs.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";

export const AGENT_PROFILES_SOURCE_REF = "farplane/agents.yaml";

export type AgentProfileVisionMode = "off" | "turn_snapshot";

export type ProjectAgentVoiceProfile = {
  provider: string;
  model: string;
  voiceId: string;
};

export type ProjectAgentVisionProfile = {
  mode: AgentProfileVisionMode;
};

export type AgentProfileEyebrows = "angled" | "arched" | "straight";

export type ProjectAgentAppearanceProfile = {
  accent: string;
  skinTone: string;
  hairColor: string;
  eyebrows: AgentProfileEyebrows;
};

export type ProjectAgentProfile = {
  agentId: string;
  name: string;
  title: string;
  background: string;
  portraitRef: string;
  appearance?: ProjectAgentAppearanceProfile;
  voice: ProjectAgentVoiceProfile;
  vision: ProjectAgentVisionProfile;
  localOverride: true;
};

export type ProjectAgentProfilesResult = {
  exists: boolean;
  version: 1 | null;
  profiles: ProjectAgentProfile[];
  errors: string[];
  sourceRef: typeof AGENT_PROFILES_SOURCE_REF;
};

type JsonObject = Record<string, unknown>;

const ROOT_KEYS = new Set(["version", "agents"]);
const PROFILE_KEYS = new Set([
  "name",
  "title",
  "background",
  "portrait",
  "appearance",
  "voice",
  "vision",
]);
const APPEARANCE_KEYS = new Set(["accent", "skinTone", "hairColor", "eyebrows"]);
const VOICE_KEYS = new Set(["provider", "model", "voiceId"]);
const VISION_KEYS = new Set(["mode"]);
// Runtime adapters use colon-delimited namespaces (for example `codex-pm:<project-id>`).
const CANONICAL_AGENT_ID = /^[a-z0-9](?:[a-z0-9._:-]*[a-z0-9])?$/;
const HEX_COLOR = /^#[\da-f]{6}$/i;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function requiredString(
  row: JsonObject,
  key: string,
  location: string,
  errors: string[],
): string | null {
  const value = row[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${location}.${key}: expected a non-empty string`);
    return null;
  }
  return value.trim();
}

function rejectUnknownKeys(
  row: JsonObject,
  allowed: ReadonlySet<string>,
  location: string,
  errors: string[],
): void {
  for (const key of Object.keys(row)) {
    if (!allowed.has(key)) errors.push(`${location}.${key}: unknown field`);
  }
}

/**
 * Returns a portable project-relative ref. The bridge still performs its own
 * containment check before reading the asset; this validation prevents a profile
 * document from requesting an absolute, URL-like, or traversing path.
 */
export function normalizeAgentPortraitRef(value: string): string | null {
  const candidate = value.trim();
  if (
    !candidate ||
    candidate.includes("\\") ||
    candidate.includes("\0") ||
    candidate.startsWith("/") ||
    /^[a-z][a-z\d+.-]*:/i.test(candidate) ||
    candidate.includes("?") ||
    candidate.includes("#")
  ) {
    return null;
  }

  const normalized = path.posix.normalize(candidate.replace(/^\.\//, ""));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return null;
  return normalized;
}

function parseProfile(agentId: string, value: unknown, errors: string[]): ProjectAgentProfile | null {
  const location = `agents.${agentId}`;
  const row = asObject(value);
  if (!row) {
    errors.push(`${location}: expected an object`);
    return null;
  }
  rejectUnknownKeys(row, PROFILE_KEYS, location, errors);

  const name = requiredString(row, "name", location, errors);
  const title = requiredString(row, "title", location, errors);
  const background = requiredString(row, "background", location, errors);
  const portrait = requiredString(row, "portrait", location, errors);
  const portraitRef = portrait ? normalizeAgentPortraitRef(portrait) : null;
  if (portrait && !portraitRef) errors.push(`${location}.portrait: expected a safe project-relative path`);

  const appearance = row.appearance === undefined ? null : asObject(row.appearance);
  if (row.appearance !== undefined && !appearance) {
    errors.push(`${location}.appearance: expected an object`);
  }
  if (appearance) rejectUnknownKeys(appearance, APPEARANCE_KEYS, `${location}.appearance`, errors);
  const accent = appearance
    ? requiredString(appearance, "accent", `${location}.appearance`, errors)
    : null;
  const skinTone = appearance
    ? requiredString(appearance, "skinTone", `${location}.appearance`, errors)
    : null;
  const hairColor = appearance
    ? requiredString(appearance, "hairColor", `${location}.appearance`, errors)
    : null;
  const eyebrows = appearance?.eyebrows;
  for (const [key, color] of [
    ["accent", accent],
    ["skinTone", skinTone],
    ["hairColor", hairColor],
  ] as const) {
    if (color && !HEX_COLOR.test(color)) {
      errors.push(`${location}.appearance.${key}: expected a six-digit hex color`);
    }
  }
  if (
    appearance &&
    eyebrows !== "angled" &&
    eyebrows !== "arched" &&
    eyebrows !== "straight"
  ) {
    errors.push(
      `${location}.appearance.eyebrows: expected "angled", "arched", or "straight"`,
    );
  }

  const voice = asObject(row.voice);
  if (!voice) errors.push(`${location}.voice: expected an object`);
  else rejectUnknownKeys(voice, VOICE_KEYS, `${location}.voice`, errors);
  const provider = voice ? requiredString(voice, "provider", `${location}.voice`, errors) : null;
  const model = voice ? requiredString(voice, "model", `${location}.voice`, errors) : null;
  const voiceId = voice ? requiredString(voice, "voiceId", `${location}.voice`, errors) : null;

  const vision = asObject(row.vision);
  if (!vision) errors.push(`${location}.vision: expected an object`);
  else rejectUnknownKeys(vision, VISION_KEYS, `${location}.vision`, errors);
  const mode = vision?.mode;
  if (mode !== "off" && mode !== "turn_snapshot") {
    errors.push(`${location}.vision.mode: expected "off" or "turn_snapshot"`);
  }

  if (!name || !title || !background || !portraitRef || !provider || !model || !voiceId) return null;
  if (mode !== "off" && mode !== "turn_snapshot") return null;
  if (
    appearance &&
    (!accent ||
      !skinTone ||
      !hairColor ||
      !HEX_COLOR.test(accent) ||
      !HEX_COLOR.test(skinTone) ||
      !HEX_COLOR.test(hairColor) ||
      (eyebrows !== "angled" && eyebrows !== "arched" && eyebrows !== "straight"))
  ) {
    return null;
  }

  return {
    agentId,
    name,
    title,
    background,
    portraitRef,
    ...(appearance && accent && skinTone && hairColor
      ? {
          appearance: {
            accent,
            skinTone,
            hairColor,
            eyebrows: eyebrows as AgentProfileEyebrows,
          },
        }
      : {}),
    voice: { provider, model, voiceId },
    vision: { mode },
    localOverride: true,
  };
}

export async function loadProjectAgentProfiles(projectRoot: string): Promise<ProjectAgentProfilesResult> {
  const sourceRef = AGENT_PROFILES_SOURCE_REF;
  const sourcePath = path.join(projectRoot, sourceRef);
  let raw: string;
  try {
    raw = await readFile(sourcePath, "utf8");
  } catch (error) {
    const code = asObject(error)?.code;
    return {
      exists: code !== "ENOENT",
      version: null,
      profiles: [],
      errors: code === "ENOENT" ? [] : [`${sourceRef}: unable to read profile config`],
      sourceRef,
    };
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n", 1)[0] : "invalid YAML";
    return {
      exists: true,
      version: null,
      profiles: [],
      errors: [`${sourceRef}: ${message}`],
      sourceRef,
    };
  }

  const errors: string[] = [];
  const root = asObject(parsed);
  if (!root) {
    return {
      exists: true,
      version: null,
      profiles: [],
      errors: [`${sourceRef}: expected an object`],
      sourceRef,
    };
  }
  rejectUnknownKeys(root, ROOT_KEYS, sourceRef, errors);

  const version = root.version === 1 ? 1 : null;
  if (version === null) errors.push(`${sourceRef}.version: expected 1`);

  const agents = asObject(root.agents);
  if (!agents) errors.push(`${sourceRef}.agents: expected an object keyed by agentId`);

  const profiles: ProjectAgentProfile[] = [];
  if (agents && version === 1) {
    for (const [agentId, value] of Object.entries(agents)) {
      if (!CANONICAL_AGENT_ID.test(agentId)) {
        errors.push(`agents.${agentId}: expected a canonical agentId`);
        continue;
      }
      const errorCount = errors.length;
      const profile = parseProfile(agentId, value, errors);
      if (profile && errors.length === errorCount) profiles.push(profile);
    }
  }

  return { exists: true, version, profiles, errors, sourceRef };
}
