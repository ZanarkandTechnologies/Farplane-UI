"use client";

import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { tierColor } from "./skill-os-constants";
import type { SkillDocsPayload, SkillGraphNode } from "./skill-os-types";

function normalizeVersion(value: unknown): string {
  if (value === null || value === undefined || value === "") return "missing";
  return String(value);
}

export function SkillOsStandardsTab({
  docs,
  nodes,
}: {
  docs: SkillDocsPayload | null;
  nodes: SkillGraphNode[];
}): ReactElement {
  const rows = nodes
    .map((node) => {
      const frontmatter = docs?.skills[node.id]?.frontmatter ?? {};
      return {
        id: node.id,
        source: node.source ?? "local",
        templateVersion: normalizeVersion(frontmatter.skill_template_version),
        tier: node.tier ?? 3,
        version: normalizeVersion(frontmatter.version),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const templateVersions = new Set(rows.map((row) => row.templateVersion));
  const missingTemplate = rows.filter((row) => row.templateVersion === "missing").length;
  const localCount = rows.filter((row) => row.source !== "external").length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Skills</p>
          <p className="mt-2 text-2xl font-semibold">{rows.length}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Local</p>
          <p className="mt-2 text-2xl font-semibold">{localCount}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Template Versions</p>
          <p className="mt-2 text-2xl font-semibold">{templateVersions.size}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Missing Template</p>
          <p className="mt-2 text-2xl font-semibold">{missingTemplate}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_5rem] gap-3 border-b px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
          <span>Skill</span>
          <span>Source</span>
          <span>Template</span>
          <span>Version</span>
          <span>Tier</span>
        </div>
        <div className="max-h-[58vh] overflow-auto">
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_5rem] gap-3 border-b px-4 py-3 text-sm last:border-b-0"
            >
              <span className="truncate font-medium">{row.id}</span>
              <span className="truncate text-muted-foreground">{row.source}</span>
              <Badge variant={row.templateVersion === "missing" ? "outline" : "secondary"}>
                {row.templateVersion}
              </Badge>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {row.version}
              </span>
              <span>
                <span
                  className="mr-1 inline-block size-2 rounded-full"
                  style={{ backgroundColor: tierColor(row.tier) }}
                />
                T{row.tier}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
