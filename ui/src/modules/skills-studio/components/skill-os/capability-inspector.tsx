"use client";

import { X } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { capabilityNodeLabel } from "./capability-map-model";
import type { SkillGraphNode } from "./skill-os-types";

function displaySkillName(value: string): string {
  return value.replaceAll(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function CapabilityInspector({
  node,
  onClose,
  onOpenOwnerSkill,
}: {
  node: SkillGraphNode;
  onClose: () => void;
  onOpenOwnerSkill: (skillId: string) => void;
}): ReactElement {
  const ownerSkill = node.parent_skill ?? node.skill_id ?? "";
  return (
    <aside
      aria-label="Capability details"
      className="absolute right-4 top-4 z-30 w-[min(23rem,calc(100%-2rem))] border bg-background/95 p-4 shadow-xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Capability
          </p>
          <h2 className="mt-1 break-words [font-family:Inter,sans-serif] text-lg font-semibold tracking-tight">
            {capabilityNodeLabel(node)}
          </h2>
        </div>
        <Button
          aria-label="Close capability details"
          className="shrink-0"
          size="icon"
          variant="ghost"
          onClick={onClose}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <dl className="mt-4 divide-y border-y text-sm">
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-1 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Type
          </dt>
          <dd>Artifact specialist</dd>
        </div>
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-1 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Output
          </dt>
          <dd className="break-words">{node.output ?? "No output declared."}</dd>
        </div>
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-1 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Method
          </dt>
          <dd className="break-words font-mono text-xs">{node.method_id ?? "Not declared."}</dd>
        </div>
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-1 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Owner
          </dt>
          <dd className="break-words">
            {ownerSkill ? displaySkillName(ownerSkill) : "Not declared."}
          </dd>
        </div>
      </dl>
      <Button
        className="mt-4 w-full"
        disabled={!ownerSkill}
        onClick={() => onOpenOwnerSkill(ownerSkill)}
      >
        Open {ownerSkill || "owner"} skill
      </Button>
    </aside>
  );
}
