import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { FeedScoutItem } from "@/modules/team-workspace/lib/feed-scout/feed-scout";
import {
  actionabilityVariant,
  displayText,
  formatDateTime,
  shortUrl,
  sourceFacts,
} from "./news-feed-formatters";
import { NewsSourceTile } from "./news-source-tile";

export function NewsItemCard({ item }: { item: FeedScoutItem }): ReactElement {
  const sourceLabel = [item.platform, item.kind, item.sourceName || item.sourceId]
    .filter(Boolean)
    .join(" / ");
  const facts = sourceFacts(item);
  const primaryFacts = facts.slice(0, 3);
  return (
    <Card className="overflow-hidden rounded-md py-0">
      <CardContent className="grid min-h-[11rem] items-center gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 self-center">
          <div className="max-w-[82ch]">
            <div className="mb-3 flex min-w-0 flex-wrap items-center gap-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {typeof item.rank === "number" ? (
                  <Badge variant="outline">#{item.rank}</Badge>
                ) : null}
                <Badge variant="secondary">{item.entityGroupName || item.entityGroupId}</Badge>
                {item.novelty ? <Badge variant="outline">{displayText(item.novelty)}</Badge> : null}
                {item.todayDelta?.kind ? (
                  <Badge variant="outline">
                    {displayText(item.todayDelta.kind)}
                    {item.todayDelta.confidence ? ` / ${item.todayDelta.confidence}` : ""}
                  </Badge>
                ) : null}
                {item.actionability?.label ? (
                  <Badge variant={actionabilityVariant(item.actionability.label)}>
                    {item.actionability.label}
                  </Badge>
                ) : null}
              </div>
            </div>
            <p className="line-clamp-2 break-words text-sm font-medium [overflow-wrap:anywhere]">
              {item.title}
            </p>
            {item.whyCareToday ? (
              <p className="mt-2 line-clamp-2 break-words border-l-2 pl-3 text-sm [overflow-wrap:anywhere]">
                {item.whyCareToday}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {primaryFacts.map((fact) => (
                <span key={fact.label} className="min-w-0">
                  <span className="text-foreground">{fact.value}</span> {fact.label.toLowerCase()}
                </span>
              ))}
              <span>{formatDateTime(item.publishedAt)}</span>
            </div>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer text-foreground">Details</summary>
              <div className="mt-3 space-y-3 rounded-md border bg-background/40 p-3">
                {item.summary ? (
                  <p className="break-words [overflow-wrap:anywhere]">{item.summary}</p>
                ) : null}
                {item.actionability?.reason ? (
                  <p className="break-words [overflow-wrap:anywhere]">
                    action: {item.actionability.reason}
                  </p>
                ) : null}
                {facts.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {facts.slice(0, 6).map((fact) => (
                      <div key={fact.label} className="rounded-md border bg-background/50 p-2">
                        <p className="text-[10px] uppercase tracking-[0.12em]">{fact.label}</p>
                        <p className="mt-1 break-words font-medium text-foreground [overflow-wrap:anywhere]">
                          {fact.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="break-words [overflow-wrap:anywhere]">
                  {formatDateTime(item.publishedAt)} {sourceLabel}
                  {item.canonicalUrl ? ` ${shortUrl(item.canonicalUrl)}` : ""}
                </p>
                {item.evidenceRefs.length > 0 ? (
                  <div className="space-y-1">
                    {item.evidenceRefs.slice(0, 3).map((ref) => (
                      <p key={ref} className="break-words [overflow-wrap:anywhere]">
                        evidence: {ref}
                      </p>
                    ))}
                  </div>
                ) : null}
                {item.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {item.tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
          </div>
        </div>
        <NewsSourceTile item={item} />
      </CardContent>
    </Card>
  );
}
