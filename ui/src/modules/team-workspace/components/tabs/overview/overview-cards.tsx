import type { ReactElement } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function HudMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="truncate text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function OverviewTrendBars({
  seed,
  active = false,
}: {
  seed: string;
  active?: boolean;
}): ReactElement {
  const code = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  const bars = [0, 1, 2, 3, 4, 5, 6].map((offset) => ({
    key: `${seed}-${offset}`,
    height: 25 + ((code + offset * 19) % 52),
  }));
  return (
    <div className="flex h-10 items-end gap-1" aria-hidden="true">
      {bars.map((bar) => (
        <span
          key={bar.key}
          className={
            active ? "w-2 rounded-sm bg-primary/70" : "w-2 rounded-sm bg-muted-foreground/25"
          }
          style={{ height: `${bar.height}%` }}
        />
      ))}
    </div>
  );
}

export function SignalCard({
  label,
  value,
  description,
  detail,
  target,
  provider,
}: {
  label: string;
  value: string;
  description?: string;
  detail: string;
  target: string;
  provider: string;
}): ReactElement {
  const hasProvider = provider !== "provider_missing" && provider !== "source gap";
  const isGap = provider === "source gap" || value === "waiting" || value === "missing";
  const statusLabel = isGap ? "gap" : "ok";
  return (
    <div className="flex min-h-44 min-w-0 flex-col justify-between rounded-md border bg-card p-3">
      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="break-words text-xs font-medium uppercase tracking-normal text-muted-foreground [overflow-wrap:anywhere]">
            {label}
          </p>
          {description ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`How ${label} is calculated`}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-80 text-left leading-5">
                {description}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <p className="break-words text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]">
          {value}
        </p>
        <p className="break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
          {detail || target}
        </p>
      </div>
      <div className="flex min-w-0 items-end justify-between gap-3 pt-3">
        {isGap ? (
          <div className="flex h-10 items-end text-xs text-muted-foreground">-</div>
        ) : (
          <OverviewTrendBars seed={`${label}:${target}:${provider}`} active={hasProvider} />
        )}
        <Badge
          variant={isGap ? "secondary" : "outline"}
          className="shrink-0 uppercase tracking-[0.12em]"
        >
          {statusLabel}
        </Badge>
      </div>
    </div>
  );
}
