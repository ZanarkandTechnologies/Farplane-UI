"use client";

/** Read-only operating panel for an integration facility; never starts a task/chat. */

import { RadioTower } from "lucide-react";
import type { ReactElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/store";
import { resolveSystemFacility } from "../lib/system-facility-registry";

export function SystemFacilityConsole(): ReactElement | null {
  const facilityId = useAppStore((state) => state.activeSystemFacilityId);
  const setFacilityId = useAppStore((state) => state.setActiveSystemFacilityId);
  const facility = resolveSystemFacility(facilityId);

  return (
    <Dialog open={Boolean(facility)} onOpenChange={(open) => !open && setFacilityId(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-md border bg-muted/30 p-2 text-sky-500">
              <RadioTower className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{facility?.displayName ?? "System facility"}</DialogTitle>
              <DialogDescription className="mt-1">
                Operated system: <span className="font-mono">{facility?.system ?? "unknown"}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="rounded-md border bg-muted/15 p-4 text-sm leading-6 text-muted-foreground">
          {facility?.detail ?? "This system facility is not available."}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Start artifact work at its workstation. Delivery remains an explicit operator action in
          the bound task thread; this facility does not own chats, tickets, or history.
        </p>
      </DialogContent>
    </Dialog>
  );
}
