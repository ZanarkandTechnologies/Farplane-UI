/**
 * Ownership: office-level affordance for the transient multi-employee call roster.
 * Input: Ctrl/Cmd-selected employee ids. Output: start/clear actions for the call dialog.
 * Side effects: only updates the realtime-call Zustand store.
 */
import { Phone, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeCallStore } from "../store";

export function RealtimeCallLauncher(): React.JSX.Element | null {
  const selectedEmployeeIds = useRealtimeCallStore((state) => state.selectedEmployeeIds);
  const isOpen = useRealtimeCallStore((state) => state.isOpen);
  const openCall = useRealtimeCallStore((state) => state.openCall);
  const clearSelection = useRealtimeCallStore((state) => state.clearSelection);

  if (selectedEmployeeIds.length === 0 || isOpen) return null;

  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 z-[71] flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 p-1.5 pl-3 shadow-xl backdrop-blur">
      <UsersRound className="size-4 text-primary" aria-hidden="true" />
      <span className="whitespace-nowrap text-sm font-medium">
        {selectedEmployeeIds.length} selected
      </span>
      <Button size="sm" className="rounded-full" onClick={() => openCall()}>
        <Phone className="size-4" aria-hidden="true" /> Call {selectedEmployeeIds.length}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8 rounded-full"
        aria-label="Clear call selection"
        onClick={clearSelection}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
