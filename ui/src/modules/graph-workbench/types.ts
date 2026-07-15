"use client";

export type GraphWorkbenchNode = {
  description?: string;
  frameworkRole?: string;
  id: string;
  kind: string;
  label: string;
  path?: string;
  weight?: number;
};

export type GraphWorkbenchEdge = {
  color?: string;
  directed?: boolean;
  label?: string;
  renderKey?: string;
  source: string;
  target: string;
  type?: string;
};

export type PositionedGraphWorkbenchNode = GraphWorkbenchNode & {
  degree: number;
  radius: number;
  x: number;
  y: number;
};

export type GraphWorkbenchLayout = {
  edges: Array<GraphWorkbenchEdge & { renderKey: string }>;
  nodes: PositionedGraphWorkbenchNode[];
  points: Map<string, { x: number; y: number }>;
};

export type GraphWorkbenchKind = {
  color: string;
  foreground?: string;
  id: string;
  label: string;
};
