import React from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OfficeDataProvider } from "@/providers/office-data-provider";
import { FarplaneShell } from "@/shell";

export function OfficePage(): React.JSX.Element {
  return (
    <main className="w-[100dvw] h-[100dvh] relative">
      <OfficeDataProvider>
        <SidebarProvider defaultOpen={false}>
          <SidebarInset className="h-[100dvh]">
            <FarplaneShell config={{ renderer: "office3d" }} />
          </SidebarInset>
        </SidebarProvider>
      </OfficeDataProvider>
    </main>
  );
}
