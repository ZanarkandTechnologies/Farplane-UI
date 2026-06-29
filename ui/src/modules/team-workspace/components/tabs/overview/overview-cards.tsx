import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  detail,
  target,
  provider,
}: {
  label: string;
  value: string;
  detail: string;
  target: string;
  provider: string;
}): ReactElement {
  const hasProvider = provider !== "provider_missing";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border bg-card p-3">
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </p>
        <p className="break-words text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]">
          {value}
        </p>
        <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {detail}
        </p>
        <Badge
          variant={hasProvider ? "outline" : "secondary"}
          className="max-w-full whitespace-normal break-words text-left [overflow-wrap:anywhere]"
        >
          {provider}
        </Badge>
      </div>
      <div className="flex min-w-24 flex-col items-end justify-between gap-2">
        <OverviewTrendBars seed={`${label}:${target}:${provider}`} active={hasProvider} />
        <p className="max-w-28 break-words text-right text-[10px] uppercase tracking-[0.12em] text-muted-foreground [overflow-wrap:anywhere]">
          {target}
        </p>
      </div>
    </div>
  );
}
