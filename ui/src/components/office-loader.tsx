/**
 * OFFICE LOADER
 * =============
 * Bootstrap overlay for the office scene.
 *
 * KEY CONCEPTS:
 * - This module owns only the loading overlay presentation; bootstrap state lives in
 *   `office-bootstrap.ts` and `office-simulation.tsx`.
 * - The loader stays centered, but it must still read like the rest of Farplane's
 *   square-edged material HUD instead of inventing a separate visual language.
 * - Bootstrap stages render as a compact status rail so the init overlay stays
 *   quiet and does not compete with the office scene it is preparing.
 *
 * USAGE:
 * - Render while `bootstrapState.isReady` is false in `office-simulation.tsx`
 * - Pass ordered bootstrap stages from `buildOfficeBootstrapStages`
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0160
 */

import type { OfficeBootstrapStage } from "./office-bootstrap";

type OfficeLoaderProps = {
  completionRatio: number;
  stages: OfficeBootstrapStage[];
};

const BUILDING_WINDOW_COUNT = 15;
const BUILDING_WINDOWS = Array.from({ length: BUILDING_WINDOW_COUNT }, (_, index) => index);

export function OfficeLoader({ completionRatio, stages }: OfficeLoaderProps): React.JSX.Element {
  const activeStage = stages.find((stage) => !stage.isReady) ?? stages[stages.length - 1];
  const safeCompletionRatio = Math.min(1, Math.max(0, completionRatio));
  const completionPercent = Math.round(safeCompletionRatio * 100);
  const litWindowCount = Math.round(safeCompletionRatio * BUILDING_WINDOW_COUNT);

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-background/95 px-6 backdrop-blur-md">
      <div className="flex w-full max-w-md flex-col items-center gap-7 border border-border bg-background/95 px-7 py-8 text-center shadow-2xl sm:px-9">
        <div
          className="relative h-32 w-24 border border-border bg-card shadow-sm"
          aria-label={`Office bootstrap ${completionPercent}% complete`}
          role="img"
        >
          <div
            className="absolute inset-x-0 bottom-0 bg-primary/18 transition-[height] duration-500 ease-out"
            style={{ height: `${completionPercent}%` }}
          />
          <div className="absolute -top-3 left-1/2 h-3 w-10 -translate-x-1/2 border border-border border-b-0 bg-card" />
          <div className="absolute inset-3 grid grid-cols-3 gap-2">
            {BUILDING_WINDOWS.map((windowIndex) => {
              const bottomWindowIndex = BUILDING_WINDOW_COUNT - windowIndex;
              const isLit = bottomWindowIndex <= litWindowCount;

              return (
                <div
                  key={windowIndex}
                  className={
                    isLit
                      ? "border border-primary/45 bg-primary transition-colors duration-300"
                      : "border border-border bg-background transition-colors duration-300"
                  }
                />
              );
            })}
          </div>
          <div className="absolute -bottom-3 left-1/2 h-3 w-8 -translate-x-1/2 border border-border border-t-0 bg-background" />
        </div>

        <div className="flex w-full flex-col items-center gap-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Farplane init</p>
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Loading office</h2>
          <p className="min-h-6 max-w-sm text-sm leading-6 text-muted-foreground">
            {activeStage?.detail}
          </p>
        </div>

        <div className="w-full space-y-4" aria-label="Bootstrap progress">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">{activeStage?.label}</span>
            <span className="tabular-nums text-muted-foreground">{completionPercent}%</span>
          </div>
          <div className="h-px overflow-hidden bg-border">
            <div
              className="h-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-left">
            {stages.map((stage) => {
              const isActive = stage.id === activeStage?.id;
              const isEmphasized = stage.isReady || isActive;

              return (
                <div key={stage.id} className="min-w-0 space-y-2">
                  <div
                    className={
                      isActive
                        ? "h-1 bg-primary"
                        : stage.isReady
                          ? "h-1 bg-primary/55"
                          : "h-1 bg-border"
                    }
                  />
                  <p
                    className={
                      isEmphasized
                        ? "text-xs font-medium leading-5 text-foreground"
                        : "text-xs leading-5 text-muted-foreground"
                    }
                  >
                    {stage.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
