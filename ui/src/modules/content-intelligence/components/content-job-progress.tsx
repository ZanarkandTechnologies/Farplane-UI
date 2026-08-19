import { AlertCircle, CheckCircle2, Clock3, ExternalLink, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { contentJobProgressView } from "../lib/content-intelligence-model";
import type { ContentIntelligenceItem } from "../types";

/** Reusable persisted analysis state for compact cards and expanded source details. */
export function ContentJobProgress({
  item,
  compact = false,
  nowMs = Date.now(),
}: {
  item: Pick<ContentIntelligenceItem, "canonicalRef" | "jobs">;
  compact?: boolean;
  nowMs?: number;
}): React.JSX.Element | null {
  const progress = contentJobProgressView(item, nowMs);
  if (!progress) return null;
  const Icon =
    progress.status === "active"
      ? LoaderCircle
      : progress.status === "ready"
        ? CheckCircle2
        : progress.status === "failed" || progress.status === "needs_review"
          ? AlertCircle
          : Clock3;
  const tone =
    progress.status === "failed" || progress.status === "needs_review"
      ? "border-destructive/40 bg-destructive/5"
      : progress.status === "ready"
        ? "border-primary/30 bg-primary/5"
        : "border-border/80 bg-muted/20";

  return (
    <section
      aria-label="Analysis progress"
      aria-live={compact ? undefined : "polite"}
      data-testid="content-job-progress"
      data-status={progress.status}
      className={`${tone} border ${compact ? "mx-3 mb-3 p-2.5 sm:mx-4" : "rounded-md p-3"}`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon
          aria-hidden="true"
          className={`mt-0.5 size-3.5 shrink-0 ${progress.status === "active" ? "animate-spin motion-reduce:animate-none" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 px-1.5 text-[9px] uppercase tracking-wide">
              {progress.statusLabel}
            </Badge>
            <span className="text-[10px] font-medium text-foreground">{progress.stageLabel}</span>
            <time
              dateTime={progress.updatedAt}
              title={progress.updatedAt}
              className="text-[9px] text-muted-foreground"
            >
              {progress.freshnessLabel}
            </time>
          </div>
          <p
            className={`${compact ? "line-clamp-2" : ""} mt-1 text-[11px] leading-4 text-muted-foreground`}
          >
            {progress.message}
          </p>
          {progress.action ? (
            <a
              href={item.canonicalRef}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-7 items-center gap-1 text-[11px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {progress.action.label} <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
