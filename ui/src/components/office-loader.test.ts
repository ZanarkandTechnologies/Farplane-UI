import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildOfficeBootstrapStages } from "./office-bootstrap";
import { OfficeLoader } from "./office-loader";

describe("office loader", () => {
  it("renders the office fill indicator and active bootstrap state", () => {
    const stages = buildOfficeBootstrapStages({
      dataReady: true,
      meshesReady: false,
      navigationReady: false,
    });

    const markup = renderToStaticMarkup(
      createElement(OfficeLoader, { completionRatio: 2 / 3, stages }),
    );

    expect(markup).toContain("Loading office");
    expect(markup).toContain("Farplane init");
    expect(markup).toContain("Preparing scene assets");
    expect(markup).toContain("Building navigation grid");
    expect(markup).toContain("Bootstrap progress");
    expect(markup).toContain("67%");
    expect(markup).toContain("Office bootstrap 67% complete");
    expect(markup).toContain("grid grid-cols-3 gap-2 text-left");
    expect(markup).toContain("transition-[height]");
    expect(markup).not.toContain("spinner");
    expect(markup).not.toContain("truncate");
  });
});
