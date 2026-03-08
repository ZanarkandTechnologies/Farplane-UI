import { Loader } from "@/components/ai-elements/loader";

import type { OfficeBootstrapStage } from "./office-bootstrap";

type OfficeLoaderProps = {
  completionRatio: number;
  stages: OfficeBootstrapStage[];
};

export function OfficeLoader({
  completionRatio,
  stages,
}: OfficeLoaderProps): React.JSX.Element {
  const activeStage = stages.find((stage) => !stage.isReady) ?? stages[stages.length - 1];
  const completionPercent = Math.round(completionRatio * 100);

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-background/92 backdrop-blur-md">
      <div className="flex w-full max-w-md flex-col items-center gap-6 px-6 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-border/70 bg-card/80 shadow-2xl">
          <div className="absolute inset-2 rounded-full border border-primary/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-primary/80 animate-spin" />
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold tracking-[0.24em] text-primary">
            SC
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
            ShellCorp
          </p>
          <h2 className="text-2xl font-semibold text-foreground">Loading office</h2>
          <p className="text-sm text-muted-foreground">{activeStage?.detail}</p>
        </div>

        <div className="w-full space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{activeStage?.label}</span>
            <span>{completionPercent}%</span>
          </div>
        </div>

        <div className="grid w-full gap-2 text-left">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2"
            >
              {stage.isReady ? (
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              ) : (
                <Loader className="text-primary" size={14} />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{stage.label}</p>
                <p className="truncate text-xs text-muted-foreground">{stage.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
