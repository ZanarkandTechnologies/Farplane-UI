import { ExternalLink, Github, Globe2, Star, Youtube } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import type { FeedScoutItem } from "@/modules/team-workspace/lib/feed-scout/feed-scout";
import { buildFeedItemBookmark, displayText, parseWebUrl } from "./news-feed-formatters";

export function NewsSourceTile({ item }: { item: FeedScoutItem }): ReactElement | null {
  const embed = item.embed ?? buildFeedItemBookmark(item);
  if (!embed?.url) return null;
  const href = parseWebUrl(embed.url)?.href ?? embed.url;
  return (
    <div className="min-w-0 self-center lg:w-80 lg:justify-self-end">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex h-36 w-full min-w-0 flex-col justify-between overflow-hidden rounded-md border bg-background p-3 text-muted-foreground hover:text-foreground"
      >
        {embed.imageUrl ? (
          <img
            src={embed.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
            loading="lazy"
          />
        ) : null}
        <div className="relative flex items-start justify-between gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/30">
            <ProviderIcon provider={embed.provider} />
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 opacity-75 group-hover:opacity-100" />
        </div>
        <div className="relative min-w-0 space-y-1.5">
          <p className="line-clamp-2 break-words text-xs font-medium text-foreground [overflow-wrap:anywhere]">
            {embed.title ?? item.title}
          </p>
          {embed.byline ? <p className="truncate text-xs">{embed.byline}</p> : null}
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{embed.provider}</Badge>
            <Badge variant="secondary">{displayText(embed.cardType)}</Badge>
          </div>
        </div>
      </a>
    </div>
  );
}

function ProviderIcon({ provider }: { provider: string }): ReactElement {
  const normalized = provider.toLowerCase();
  if (normalized === "github") return <Github className="h-5 w-5" />;
  if (normalized === "youtube") return <Youtube className="h-5 w-5" />;
  if (normalized === "web") return <Globe2 className="h-5 w-5" />;
  return <Star className="h-5 w-5" />;
}
