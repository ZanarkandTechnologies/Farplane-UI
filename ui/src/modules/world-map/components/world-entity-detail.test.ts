import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WorldNode, WorldTimelineEntry } from "../types";
import { WorldEntityDetail } from "./world-entity-detail";

function node(projectId: string): WorldNode {
  return {
    key: `${projectId}::local:shared`,
    entityId: "shared",
    projectId,
    name: `${projectId} Shared Entity`,
    kind: "company",
    aliases: [],
    metadata: {},
  };
}

function timeline(projectId: string, label: string): WorldTimelineEntry {
  return {
    key: `${projectId}::event`,
    projectId,
    date: "2026-08-05",
    sourceEntityId: "shared",
    entityIds: ["shared"],
    entityKeys: [`${projectId}::local:shared`],
    context: label,
    displayContext: label,
    tags: {},
  };
}

describe("WorldEntityDetail", () => {
  it("matches timeline evidence by project-qualified entity key", () => {
    const nodes = [node("acme"), node("nova")];
    const html = renderToStaticMarkup(
      createElement(WorldEntityDetail, {
        nodes,
        edges: [],
        timeline: [timeline("acme", "Acme evidence"), timeline("nova", "Nova evidence")],
        selection: { type: "node", key: nodes[0].key },
        onSelect: () => undefined,
      }),
    );
    expect(html).toContain("Acme evidence");
    expect(html).not.toContain("Nova evidence");
  });
});
