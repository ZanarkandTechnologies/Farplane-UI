import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ProjectAgentProfile } from "../types";
import { AgentFace } from "./agent-face";

const profile: ProjectAgentProfile = {
  agentId: "farplane-people",
  name: "Scout",
  localOverride: true,
  appearance: {
    accent: "#55a7ff",
    skinTone: "#b97856",
    hairColor: "#1e2028",
    eyebrows: "arched",
  },
};

describe("AgentFace", () => {
  it("renders the configured flat monitor identity", () => {
    const markup = renderToStaticMarkup(createElement(AgentFace, { profile }));

    expect(markup).toContain('data-face-style="monitor-flat"');
    expect(markup).toContain('data-eyebrows="arched"');
    expect(markup).toContain('data-speaking="false"');
    expect(markup).toContain("#55a7ff");
    expect(markup).toContain("#b97856");
    expect(markup).toContain("#1e2028");
  });

  it("exposes the real speaking state and a larger animated mouth", () => {
    const markup = renderToStaticMarkup(
      createElement(AgentFace, { profile, isSpeaking: true, level: 0.4 }),
    );

    expect(markup).toContain('aria-label="Scout avatar, speaking"');
    expect(markup).toContain('data-speaking="true"');
    expect(markup).toContain('width="60"');
    expect(markup).toContain('stroke-width="6"');
  });
});
