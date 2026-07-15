import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OverviewAutonomySavings } from "./overview-sections";

describe("OverviewAutonomySavings", () => {
  it("renders measured, estimated, coverage, and telemetry-owner labels", () => {
    const html = renderToStaticMarkup(
      createElement(OverviewAutonomySavings, {
        presentation: {
          attributionCoverage: 0.75,
          sourceGaps: [],
          metrics: [
            {
              id: "clone_hours",
              label: "Parallel clone hours",
              value: "8h",
              detail: "Measured elapsed agent work.",
              status: "available",
              evidenceKind: "measured",
            },
            {
              id: "potential_human_time_saved_hours_estimated",
              label: "Potential human time saved",
              value: "5.5h",
              detail: "Estimated from accepted work.",
              status: "available",
              evidenceKind: "estimated",
            },
          ],
        },
      }),
    );
    expect(html).toContain("75% attribution coverage");
    expect(html).toContain("Runtime truth: Harness Usage");
    expect(html).toContain("estimated");
  });

  it("renders an honest unavailable state", () => {
    const html = renderToStaticMarkup(
      createElement(OverviewAutonomySavings, {
        presentation: {
          attributionCoverage: null,
          sourceGaps: ["Accepted clone hours: missing acceptance evidence"],
          metrics: [
            {
              id: "accepted_clone_hours",
              label: "Accepted clone hours",
              value: "source gap",
              detail: "missing acceptance evidence",
              status: "source_gap",
              evidenceKind: "attributed",
            },
          ],
        },
      }),
    );
    expect(html).toContain("Coverage unavailable");
    expect(html).toContain("unavailable readings remain unknown");
  });
});
