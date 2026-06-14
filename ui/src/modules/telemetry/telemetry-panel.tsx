"use client";

import type { ReactElement } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UI_Z } from "@/lib/z-index";
import { TelemetryDashboardContent } from "./telemetry-dashboard-content";
import "./components/telemetry-dashboard.css";

type TelemetryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TelemetryPanel({ open, onOpenChange }: TelemetryPanelProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[88vh] min-w-[82vw] max-w-none flex-col overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Telemetry</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6">
          <TelemetryDashboardContent mode="global" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
