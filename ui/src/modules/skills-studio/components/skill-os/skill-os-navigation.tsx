"use client";

import type { ReactElement } from "react";
import type { SkillStudioSurface } from "./skill-os-navigation-state";

export function SkillOsNavigation({
  activeSurface,
  mapMode = false,
  onSurfaceChange,
}: {
  activeSurface: SkillStudioSurface;
  mapMode?: boolean;
  onSurfaceChange: (surface: SkillStudioSurface) => void;
}): ReactElement {
  return (
    <nav
      aria-label="Skills Studio views"
      className={
        mapMode
          ? "absolute right-5 top-5 z-30"
          : "flex shrink-0 items-center justify-between gap-4 border-b bg-background px-4 py-2.5"
      }
    >
      {mapMode ? null : (
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Skills Studio
          </p>
          <p className="truncate text-xs text-muted-foreground">
            What Farplane can produce · how its skills work
          </p>
        </div>
      )}
      <div
        className={
          mapMode
            ? "flex shrink-0 gap-1 rounded-md border bg-background/90 p-1 font-mono text-[10px] shadow-sm"
            : "flex shrink-0 gap-1 rounded-md border bg-muted/30 p-1 font-mono text-[10px] shadow-sm"
        }
      >
        {(
          [
            ["capabilities", "Capability Map"],
            ["library", "Skill Library"],
          ] as const
        ).map(([surface, label]) => (
          <button
            key={surface}
            type="button"
            aria-pressed={activeSurface === surface}
            className={`rounded-sm px-2.5 py-1.5 transition-colors ${
              mapMode
                ? activeSurface === surface
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
                : activeSurface === surface
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onSurfaceChange(surface)}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
