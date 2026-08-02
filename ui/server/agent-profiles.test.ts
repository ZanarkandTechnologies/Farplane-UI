import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import {
  AGENT_PROFILES_SOURCE_REF,
  loadProjectAgentProfiles,
  normalizeAgentPortraitRef,
} from "./agent-profiles";

const roots: string[] = [];

async function projectWithAgentsYaml(yaml: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "farplane-agent-profiles-"));
  roots.push(root);
  await mkdir(path.join(root, "farplane"));
  await writeFile(path.join(root, AGENT_PROFILES_SOURCE_REF), yaml, "utf8");
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project agent profiles", () => {
  it("loads the version 1 keyed contract and marks profiles as local overrides", async () => {
    const root = await projectWithAgentsYaml(`
version: 1
agents:
  farplane-pm:
    name: Mira
    title: Product lead
    background: Keeps the project moving.
    portrait: farplane/assets/agents/mira.png
    voice:
      provider: openai
      model: gpt-4o-mini-tts
      voiceId: marin
    vision:
      mode: turn_snapshot
`);

    await expect(loadProjectAgentProfiles(root)).resolves.toEqual({
      exists: true,
      version: 1,
      profiles: [
        {
          agentId: "farplane-pm",
          name: "Mira",
          title: "Product lead",
          background: "Keeps the project moving.",
          portraitRef: "farplane/assets/agents/mira.png",
          voice: { provider: "openai", model: "gpt-4o-mini-tts", voiceId: "marin" },
          vision: { mode: "turn_snapshot" },
          localOverride: true,
        },
      ],
      errors: [],
      sourceRef: "farplane/agents.yaml",
    });
  });

  it("reports a missing optional project contract without an error", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "farplane-agent-profiles-missing-"));
    roots.push(root);

    await expect(loadProjectAgentProfiles(root)).resolves.toEqual({
      exists: false,
      version: null,
      profiles: [],
      errors: [],
      sourceRef: "farplane/agents.yaml",
    });
  });

  it("accepts runtime adapter namespaces in canonical agent ids", async () => {
    const root = await projectWithAgentsYaml(`
version: 1
agents:
  "codex-pm:farplane-ui":
    name: Mira
    title: Product lead
    background: Keeps the project moving.
    portrait: farplane/assets/agents/mira.png
    voice:
      provider: openai
      model: gpt-4o-mini-tts
      voiceId: marin
    vision:
      mode: off
`);

    const result = await loadProjectAgentProfiles(root);
    expect(result.errors).toEqual([]);
    expect(result.profiles[0]?.agentId).toBe("codex-pm:farplane-ui");
  });

  it("loads a bounded procedural face identity", async () => {
    const root = await projectWithAgentsYaml(`
version: 1
agents:
  ledger:
    name: Ledger
    title: Finance Director
    background: Protects runway.
    portrait: farplane/assets/agents/ledger.png
    appearance:
      accent: "#37c987"
      skinTone: "#d7a17a"
      hairColor: "#2c2725"
      eyebrows: straight
    voice:
      provider: openai
      model: gpt-4o-mini-tts
      voiceId: cedar
    vision:
      mode: turn_snapshot
`);

    const result = await loadProjectAgentProfiles(root);
    expect(result.errors).toEqual([]);
    expect(result.profiles[0]?.appearance).toEqual({
      accent: "#37c987",
      skinTone: "#d7a17a",
      hairColor: "#2c2725",
      eyebrows: "straight",
    });
  });

  it("reports malformed YAML without exposing partial profiles", async () => {
    const root = await projectWithAgentsYaml("version: 1\nagents: [\n");

    const result = await loadProjectAgentProfiles(root);
    expect(result).toEqual(
      expect.objectContaining({
        exists: true,
        version: null,
        profiles: [],
        sourceRef: "farplane/agents.yaml",
      }),
    );
    expect(result.errors).toHaveLength(1);
  });

  it("does not expose profiles from an unsupported contract version", async () => {
    const root = await projectWithAgentsYaml(`
version: 2
agents:
  main:
    name: Farplane
    title: Founder copilot
    background: Coordinates the company.
    portrait: ui/public/zanarkand-logo.png
    voice:
      provider: openai
      model: gpt-4o-mini-tts
      voiceId: marin
    vision:
      mode: off
`);

    const result = await loadProjectAgentProfiles(root);
    expect(result.version).toBeNull();
    expect(result.profiles).toEqual([]);
    expect(result.errors).toContain("farplane/agents.yaml.version: expected 1");
  });

  it("rejects traversal, absolute, URL, and backslash portrait refs", () => {
    expect(normalizeAgentPortraitRef("./farplane/assets/avatar.png")).toBe(
      "farplane/assets/avatar.png",
    );
    expect(normalizeAgentPortraitRef("../avatar.png")).toBeNull();
    expect(normalizeAgentPortraitRef("/tmp/avatar.png")).toBeNull();
    expect(normalizeAgentPortraitRef("https://example.com/avatar.png")).toBeNull();
    expect(normalizeAgentPortraitRef("farplane\\..\\avatar.png")).toBeNull();
  });

  it("rejects redundant fields and invalid nested contract values", async () => {
    const root = await projectWithAgentsYaml(`
version: 1
agents:
  farplane-pm:
    name: Mira
    title: Product lead
    background: Keeps the project moving.
    portrait: ../private/avatar.png
    enabled: true
    realtime: true
    voice:
      provider: openai
      model: gpt-4o-mini-tts
      voiceId: marin
    vision:
      mode: realtime
`);

    const result = await loadProjectAgentProfiles(root);
    expect(result.profiles).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "agents.farplane-pm.enabled: unknown field",
        "agents.farplane-pm.realtime: unknown field",
        "agents.farplane-pm.portrait: expected a safe project-relative path",
        'agents.farplane-pm.vision.mode: expected "off" or "turn_snapshot"',
      ]),
    );
  });

  it("rejects invalid procedural face colors and eyebrow shapes", async () => {
    const root = await projectWithAgentsYaml(`
version: 1
agents:
  ledger:
    name: Ledger
    title: Finance Director
    background: Protects runway.
    portrait: farplane/assets/agents/ledger.png
    appearance:
      accent: green
      skinTone: "#d7a17a"
      hairColor: "#2c2725"
      eyebrows: surprised
    voice:
      provider: openai
      model: gpt-4o-mini-tts
      voiceId: cedar
    vision:
      mode: turn_snapshot
`);

    const result = await loadProjectAgentProfiles(root);
    expect(result.profiles).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "agents.ledger.appearance.accent: expected a six-digit hex color",
        'agents.ledger.appearance.eyebrows: expected "angled", "arched", or "straight"',
      ]),
    );
  });
});
