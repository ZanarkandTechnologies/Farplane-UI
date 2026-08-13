"use client";

import { type ReactElement, useEffect, useState } from "react";
import { OfficeWorkspaceDialog } from "@/components/office-workspace-dialog";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RawTelemetryContent } from "@/modules/hook-telemetry";
import type { TelemetryPanelTab } from "@/store";
import { TelemetryDashboardContent } from "./telemetry-dashboard-content";
import "./components/telemetry-dashboard.css";

type TelemetryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: TelemetryPanelTab;
};

export function TelemetryPanel({
  open,
  onOpenChange,
  initialTab = "usage",
}: TelemetryPanelProps): ReactElement {
  const [activeTab, setActiveTab] = useState<TelemetryPanelTab>(initialTab);

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [initialTab, open]);

  return (
    <OfficeWorkspaceDialog open={open} onOpenChange={onOpenChange}>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Harness Usage</DialogTitle>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TelemetryPanelTab)}
          className="min-h-0 flex-1 overflow-hidden px-6 pb-6 pt-3"
        >
          <TabsList>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>
          <TabsContent value="usage" className="min-h-0 flex-1 overflow-hidden">
            <TelemetryDashboardContent mode="global" />
          </TabsContent>
          <TabsContent value="events" className="min-h-0 flex-1 overflow-hidden">
            <RawTelemetryContent />
          </TabsContent>
        </Tabs>
    </OfficeWorkspaceDialog>
  );
}
