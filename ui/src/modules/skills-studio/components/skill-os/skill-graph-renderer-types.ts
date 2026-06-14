"use client";

import type { SkillGraphLayout } from "./skill-os-types";

export type SkillGraphCanvasProps = {
  edgeCount: number;
  graphNodeCount: number;
  layout: SkillGraphLayout;
  onSelectSkill: (skillId: string) => void;
  query: string;
  queryMatches: Set<string>;
  selectedSkillId: string;
};
