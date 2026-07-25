import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OverviewHighlightCard } from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";
import { OverviewHighlights } from "./overview-highlights";

const win: OverviewHighlightCard = {
  id: "win:farplane:daily-2026-07-24",
  kind: "win",
  team: "farplane",
  report: "reports/interval/daily_interval/2026-07-24T000000Z",
  summary: "Qualified reach beat the previous daily record by 42%.",
  links: [{ label: "Metric evidence", href: "https://example.com/evidence" }],
  cadence: "daily",
  period: "2026-07-24",
  createdAt: "2026-07-24T00:00:00Z",
  sourceHref: "/farplane/project-file?projectPath=%2Ftmp%2Ffarplane&ref=daily.md",
  sourceGapIds: [],
};

const failure: OverviewHighlightCard = {
  id: "failure:farplane:weekly-2026-W30",
  kind: "failure",
  team: "farplane",
  report: "reports/interval/weekly_interval/2026-07-24T000000Z",
  summary: "A simple verification was split across three handoffs.",
  lesson: "Do not delegate when the job is simpler than the handoff.",
  links: [],
  cadence: "weekly",
  period: "2026-W30",
  createdAt: "2026-07-24T00:00:00Z",
  sourceGapIds: [],
};

describe("OverviewHighlights", () => {
  it("renders separate win and failure galleries with source links and a visible lesson", () => {
    const html = renderToStaticMarkup(
      createElement(OverviewHighlights, {
        wins: [win],
        failures: [failure],
        projectionReady: true,
      }),
    );

    expect(html).toContain("Wins");
    expect(html).toContain("Failures");
    expect(html).toContain("beat the previous daily record by 42%");
    expect(html).toContain("Do not delegate when the job is simpler than the handoff.");
    expect(html).toContain(
      'href="/farplane/project-file?projectPath=%2Ftmp%2Ffarplane&amp;ref=daily.md"',
    );
    expect(html).toContain('href="https://example.com/evidence"');
    expect(html).toContain("Exceptional result");
    expect(html).not.toContain("line-clamp");
  });

  it("bounds initial history and provides progressive disclosure", () => {
    const failures = Array.from({ length: 13 }, (_, index) => ({
      ...failure,
      id: `${failure.id}:${index}`,
      summary: `Failure ${index + 1}`,
    }));
    const html = renderToStaticMarkup(
      createElement(OverviewHighlights, {
        wins: [win],
        failures,
        projectionReady: true,
      }),
    );

    expect(html).toContain("Failure 1");
    expect(html).toContain("Failure 3");
    expect(html).not.toContain("Failure 4");
    expect(html).toContain("View 10 more failures");
    expect(html).toContain('aria-expanded="false"');
  });

  it("derives a useful ticket label for generic related links", () => {
    const linkedFailure = {
      ...failure,
      links: [
        {
          label: "ticket.md",
          href: "/farplane/project-file?projectPath=%2Ftmp%2Ffarplane&ref=tickets%2FTASK-0393%2Fticket.md",
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(OverviewHighlights, {
        wins: [],
        failures: [linkedFailure],
        projectionReady: true,
      }),
    );

    expect(html).toContain("TASK-0393");
    expect(html).not.toContain(">ticket.md<");
  });

  it("renders honest empty and partial gallery states", () => {
    const empty = renderToStaticMarkup(
      createElement(OverviewHighlights, {
        wins: [],
        failures: [],
        projectionReady: true,
      }),
    );
    expect(empty).toContain("No exceptional metric win was selected for this interval.");
    expect(empty).toContain("No learnable failure was selected for this interval.");

    const partial = renderToStaticMarkup(
      createElement(OverviewHighlights, {
        wins: [win],
        failures: [],
        projectionReady: true,
      }),
    );
    expect(partial).toContain("Qualified reach beat");
    expect(partial).toContain("No learnable failure was selected");

    const absentProjection = renderToStaticMarkup(
      createElement(OverviewHighlights, {
        wins: [],
        failures: [],
        projectionReady: false,
      }),
    );
    expect(absentProjection).toContain(
      "Eligible metric wins will appear after an interval review.",
    );
  });
});
