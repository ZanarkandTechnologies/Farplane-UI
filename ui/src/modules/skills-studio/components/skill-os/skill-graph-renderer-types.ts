"use client";

import type { SkillGraphLayout } from "./skill-os-types";

export type SkillGraphCanvasProps = {
  edgeCount: number;
  graphNodeCount: number;
  graphTitle?: string;
  layout: SkillGraphLayout;
  onSelectSkill: (skillId: string) => void;
  query: string;
  queryMatches: Set<string>;
  radialMode?: "focus" | "overview";
  selectedSkillId: string;
};
