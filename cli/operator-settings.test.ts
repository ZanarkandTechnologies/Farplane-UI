import { describe, expect, it } from "vitest";
import {
  patchOperatorSettingsToml,
  parseOperatorSettingsToml,
  resolveVideoIntelligenceAnalysisProfile,
  stripSecretsFromOperatorSettingsToml,
} from "./operator-settings.js";

describe("operator settings", () => {
  it("resolves a registered feature profile from operator TOML", () => {
    const source = parseOperatorSettingsToml(`
[runtime]
state_base = "http://localhost:4747"

[features.video_intelligence.analysis]
model = "gpt-5.6-terra"
reasoning_effort = "xhigh"

[features.some_future_feature]
enabled = true
`);

    expect(resolveVideoIntelligenceAnalysisProfile(source)).toEqual({
      definition: "video_intelligence.analysis.v1",
      model: "gpt-5.6-terra",
      reasoningEffort: "xhigh",
    });
  });

  it("falls back safely for malformed Video Intelligence profiles", () => {
    expect(
      resolveVideoIntelligenceAnalysisProfile(
        parseOperatorSettingsToml(`
[features.video_intelligence.analysis]
model = ""
reasoning_effort = "impossibly-high"
`),
      ),
    ).toEqual({
      definition: "video_intelligence.analysis.v1",
      model: "gpt-5.6-terra",
      reasoningEffort: "xhigh",
    });
  });

  it("patches owned settings without changing unknown TOML values", () => {
    const source = `# Keep this future feature exactly as authored.
[features.future]
labels = ["a", "b",]
appearance = { color = "violet", enabled = true }
reviewed_at = 2026-08-13T12:34:56Z

[features.video_intelligence.analysis]
model = "gpt-5.6-luna"
reasoning_effort = "max"

[env]
VITE_GATEWAY_TOKEN = "legacy-secret"
`;
    const patched = stripSecretsFromOperatorSettingsToml(
      patchOperatorSettingsToml(source, [
        {
          path: ["features", "video_intelligence", "analysis", "model"],
          value: "gpt-5.6-terra",
        },
        {
          path: ["features", "video_intelligence", "analysis", "reasoning_effort"],
          value: "xhigh",
        },
      ]),
    );

    expect(patched).toContain("# Keep this future feature exactly as authored.");
    expect(patched).toContain('labels = ["a", "b",]');
    expect(patched).toContain('appearance = { color = "violet", enabled = true }');
    expect(patched).toContain("reviewed_at = 2026-08-13T12:34:56Z");
    expect(patched).toContain('model = "gpt-5.6-terra"');
    expect(patched).toContain('reasoning_effort = "xhigh"');
    expect(patched).not.toContain("VITE_GATEWAY_TOKEN");
  });
});
