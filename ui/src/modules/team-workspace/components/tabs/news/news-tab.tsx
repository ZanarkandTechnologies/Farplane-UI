"use client";

/**
 * Team Workspace News tab.
 * Loads local Feed Scout daily JSON and renders it as a project-scoped news feed.
 */

import { type ReactElement, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NewsItemCard } from "./news-item-card";
import { NewsToolbar } from "./news-toolbar";
import { useNewsFeed } from "./use-news-feed";

export function NewsTab({
  enabled,
  projectPath,
}: {
  enabled: boolean;
  projectId?: string | null;
  projectName?: string | null;
  projectPath?: string | null;
}): ReactElement {
  const [selectedDate, setSelectedDate] = useState("latest");
  const { availableDates, error, exists, feed, refresh, state } = useNewsFeed({
    date: selectedDate,
    enabled,
    projectPath,
  });
  const visibleItems = useMemo(() => feed?.items ?? [], [feed?.items]);

  if (state === "loading") return <NewsMessage message="Loading news..." />;
  if (state === "error") return <NewsMessage message={error ?? "News feed is unavailable."} />;
  if (!exists || !feed) return <NewsMessage message="No news feed found." />;

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <NewsToolbar
          availableDates={availableDates}
          itemCount={visibleItems.length}
          onRefresh={refresh}
          onSelectedDateChange={setSelectedDate}
          selectedDate={selectedDate}
        />

        <div className="space-y-3">
          {visibleItems.length > 0 ? (
            visibleItems.map((item) => <NewsItemCard key={item.canonicalKey} item={item} />)
          ) : (
            <Card className="rounded-md py-0">
              <CardContent className="p-4 text-sm text-muted-foreground">
                No news items found for {feed.date}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function NewsMessage({ message }: { message: string }): ReactElement {
  return (
    <ScrollArea className="h-full pr-3">
      <Card className="rounded-md">
        <CardContent className="flex h-40 items-center text-sm text-muted-foreground">
          {message}
        </CardContent>
      </Card>
    </ScrollArea>
  );
}
