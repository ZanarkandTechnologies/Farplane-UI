"use client";

import type { ReactElement } from "react";
import type { SkillGraphCanvasProps } from "./skill-graph-renderer-types";
import { SkillGraphSvgCanvas } from "./skill-graph-svg-canvas";

export function SkillGraphCanvas(props: SkillGraphCanvasProps): ReactElement {
  return <SkillGraphSvgCanvas {...props} />;
}
