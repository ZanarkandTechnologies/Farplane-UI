"use client";

import { FileClock } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";

type PlannedHook = {
  name: string;
  type: string;
  description: string;
  events: string[];
};

export function PlannedHookDetail({ hook }: { hook: PlannedHook }): ReactElement {
  return (
    <div className="flex h-full min-h-0 items-center justify-center p-8">
      <div className="max-w-[560px] rounded-md border p-6">
        <Badge variant="outline">{hook.type}</Badge>
        <h2 className="mt-3 font-semibold text-lg">{hook.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{hook.description}</p>
        <div className="mt-5 grid gap-2">
          {hook.events.map((eventName) => (
            <div key={eventName} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <FileClock className="size-4 text-muted-foreground" />
              <span className="font-mono text-xs">{eventName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
