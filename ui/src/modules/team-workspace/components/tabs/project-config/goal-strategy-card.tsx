"use client";

/**
 * Goal strategy summary card.
 * Inputs are compiled or fallback goal text; output is the shared Goals tab
 * strategy header without tab orchestration concerns.
 */

import { Target } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { shortText } from "./shared";

export function GoalStrategyCard({
  currentBet,
  northStar,
}: {
  currentBet: string;
  northStar: string;
}): ReactElement {
  return (
    <Card className="min-w-0 rounded-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4" />
            North Star
          </CardTitle>
          <Badge variant="outline">strategy</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
            Long Horizon
          </p>
          <p className="mt-2 break-words leading-6 [overflow-wrap:anywhere]">
            {shortText(northStar, "farplane/goals.md has no North Star section yet.")}
          </p>
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
            Current Bet
          </p>
          <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {shortText(currentBet, "Current bet not configured.")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
