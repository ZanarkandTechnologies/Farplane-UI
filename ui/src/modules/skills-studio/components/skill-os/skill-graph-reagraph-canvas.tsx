"use client";

/**
 * Disabled Reagraph adapter seam.
 *
 * Skill OS now ships the D3/SVG renderer as the primary graph surface. This
 * file intentionally avoids importing Reagraph so the app is not coupled to its
 * WebGL runtime or dependency chain. Reintroduce a real adapter here only after
 * a ticket proves the graph size needs a canvas renderer.
 */

import type { ReactElement } from "react";
import type { SkillGraphCanvasProps } from "./skill-graph-renderer-types";
import { SkillGraphSvgCanvas } from "./skill-graph-svg-canvas";

export default function SkillGraphReagraphCanvas(props: SkillGraphCanvasProps): ReactElement {
  return <SkillGraphSvgCanvas {...props} />;
}
