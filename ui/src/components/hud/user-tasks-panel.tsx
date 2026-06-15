"use client";

/**
 * USER COMMUNICATIONS PANEL
 * =========================
 * Founder-facing Telegram gateway configuration for routing replies into Codex threads.
 *
 * KEY CONCEPTS:
 * - Telegram reply correlation is local gateway state, not board state.
 * - The main thread receives standalone Telegram messages when no reply mapping exists.
 * - Browser code never reads Telegram bot credentials.
 */

import { Bell } from "lucide-react";
import type { ReactElement } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserCommunicationsTab } from "@/modules/user-communications";

interface UserTasksPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserTasksPanel({ isOpen, onOpenChange }: UserTasksPanelProps): ReactElement {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="z-[1000] flex h-[min(92vh,860px)] max-w-[98vw] flex-col overflow-hidden p-0 sm:max-w-[1240px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            User Communications
          </DialogTitle>
          <DialogDescription>
            Telegram activity, reply routing, and gateway controls.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden p-4">
          <UserCommunicationsTab />
        </div>
      </DialogContent>
    </Dialog>
  );
}
