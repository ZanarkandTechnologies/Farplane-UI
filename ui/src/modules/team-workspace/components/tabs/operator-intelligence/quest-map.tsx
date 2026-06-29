import { CheckCircle2, CircleDot, Lock, ShieldCheck } from "lucide-react";
import type { ReactElement } from "react";

export type QuestNodeState = "complete" | "active" | "blocked" | "locked";

export type QuestNodeModel = {
  label: string;
  detail: string;
  state: QuestNodeState;
  icon: ReactElement;
};

function questNodeClasses(state: QuestNodeState): string {
  if (state === "complete") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  if (state === "active") return "border-primary/45 bg-primary/10 text-primary";
  if (state === "blocked") return "border-destructive/45 bg-destructive/10 text-destructive";
  return "border-border bg-muted/30 text-muted-foreground";
}

function questNodeIcon(state: QuestNodeState): ReactElement {
  if (state === "complete") return <CheckCircle2 className="h-4 w-4" />;
  if (state === "blocked") return <ShieldCheck className="h-4 w-4" />;
  if (state === "locked") return <Lock className="h-4 w-4" />;
  return <CircleDot className="h-4 w-4" />;
}

function QuestNode({ node }: { node: QuestNodeModel }): ReactElement {
  return (
    <div className={`min-h-[104px] rounded-md border p-3 ${questNodeClasses(node.state)}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border bg-background/70">
          {node.icon}
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/70">
          {questNodeIcon(node.state)}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium">{node.label}</p>
      <p className="mt-1 line-clamp-2 text-xs opacity-80">{node.detail}</p>
    </div>
  );
}

export function CampaignMapGrid({ nodes }: { nodes: QuestNodeModel[] }): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {nodes.map((node, index) => (
        <div key={node.label} className="relative min-w-0">
          <QuestNode node={node} />
          {index < nodes.length - 1 ? (
            <span className="absolute -right-2 top-1/2 hidden h-px w-4 bg-border xl:block" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ProgressMeter({
  value,
  label,
  detail,
}: {
  value: number;
  label: string;
  detail: string;
}): ReactElement {
  const boundedValue = Math.min(100, Math.max(0, value));
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{boundedValue}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${boundedValue}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
