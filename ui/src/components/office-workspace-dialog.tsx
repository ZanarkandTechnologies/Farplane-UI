"use client";

/**
 * OFFICE WORKSPACE DIALOG
 * =======================
 * Shared shell for the Office's full operational workspaces.
 *
 * Inputs: open state, local dialog content, and optional DialogContent props.
 * Outputs: one viewport-safe Skill OS-sized dialog frame.
 * Side effects: Radix Dialog focus, overlay, and close behavior only.
 * Invariant: workspace sizing belongs here; feature modules own their header,
 * tabs, and one explicit body-scroll region.
 */

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { UI_Z } from "@/lib/z-index";

export const OFFICE_WORKSPACE_DIALOG_CLASS =
  "flex min-h-0 h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden overscroll-contain rounded-md p-0 sm:h-[92dvh] sm:w-[88vw] sm:max-w-[88vw]";

type OfficeWorkspaceDialogProps = Omit<
  ComponentProps<typeof DialogContent>,
  "children" | "className" | "style"
> & {
  children: ReactNode;
  className?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  style?: ComponentProps<typeof DialogContent>["style"];
};

export function OfficeWorkspaceDialog({
  children,
  className,
  onOpenChange,
  open,
  style,
  ...contentProps
}: OfficeWorkspaceDialogProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(OFFICE_WORKSPACE_DIALOG_CLASS, className)}
        style={{ zIndex: UI_Z.panelElevated, ...style }}
        {...contentProps}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
