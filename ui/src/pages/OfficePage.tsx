import React from "react";

import {
  OfficeAccessModeProvider,
  type OfficeAccessMode,
} from "@/providers/office-access-mode-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OfficeDataProvider } from "@/providers/office-data-provider";
import { FarplaneShell } from "@/shell";

export function OfficePage({
  accessMode = "operator",
}: {
  accessMode?: OfficeAccessMode;
}): React.JSX.Element {
  return (
    <main className="w-[100dvw] h-[100dvh] relative">
      <OfficeAccessModeProvider accessMode={accessMode}>
        <OfficeDataProvider>
          <SidebarProvider defaultOpen={false}>
            <SidebarInset className="h-[100dvh]">
              <FarplaneShell config={{ accessMode, renderer: "office3d" }} />
            </SidebarInset>
          </SidebarProvider>
        </OfficeDataProvider>
      </OfficeAccessModeProvider>
    </main>
  );
}
