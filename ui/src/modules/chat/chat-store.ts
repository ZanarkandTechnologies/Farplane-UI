"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  parseRoomHostConversationKey,
  type RoomHostConversationKey,
  roomHostLocalThreadId,
} from "@/modules/runtime";
import { useAppStore } from "@/store";

type ChatMode = "Chat" | "Files" | "Config";
export type ChatPresentationMode = "classic" | "story";

export type LocalChatMessage = {
  key: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  kind?: "default" | "working_output";
  parts?: LocalChatPart[];
};

export type LocalChatPart =
  | {
      kind: "thinking";
      text?: string;
      signature?: string;
      signatureId?: string;
      signatureType?: string;
      encrypted?: boolean;
      summary?: string[];
    }
  | {
      kind: "tool";
      toolName: string;
      state: "input-available" | "output-available" | "output-error";
      input?: unknown;
      output?: unknown;
      errorText?: string;
    };

export type LocalChatThread = {
  _id: string;
  title: string;
  parentThreadId?: string;
  agentId?: string;
  sessionKey?: string;
  isPendingNew?: boolean;
  conversationKey?: RoomHostConversationKey;
};

export type OpenEmployeeChatOptions = {
  openDialog?: boolean;
  displayName?: string;
  conversationKey?: RoomHostConversationKey;
};

type ChatState = {
  threadId: string | null;
  setThreadId: (id: string | null) => void;
  currentEmployeeId: string | null;
  setCurrentEmployeeId: (id: string | null) => void;
  currentTeamId: string | null;
  setCurrentTeamId: (id: string | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  currentMode: ChatMode;
  setCurrentMode: (mode: ChatMode) => void;
  threads: LocalChatThread[];
  setThreads: (threads: LocalChatThread[]) => void;
  messagesByThread: Record<string, LocalChatMessage[]>;
  setMessagesByThread: (next: Record<string, LocalChatMessage[]>) => void;
  showWorkingOutput: boolean;
  setShowWorkingOutput: (next: boolean) => void;
  presentationMode: ChatPresentationMode;
  setPresentationMode: (next: ChatPresentationMode) => void;
};

function createThreadId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultThread(title: string): LocalChatThread {
  return {
    _id: createThreadId("thread"),
    title,
  };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      threadId: null,
      setThreadId: (id) => set({ threadId: id }),
      currentEmployeeId: null,
      setCurrentEmployeeId: (id) => set({ currentEmployeeId: id }),
      currentTeamId: null,
      setCurrentTeamId: (id) => set({ currentTeamId: id }),
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      isChatOpen: false,
      setIsChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
      currentMode: "Chat",
      setCurrentMode: (mode) => set({ currentMode: mode }),
      threads: [createDefaultThread("General Chat")],
      setThreads: (threads) => set({ threads }),
      messagesByThread: {},
      setMessagesByThread: (messagesByThread) => set({ messagesByThread }),
      showWorkingOutput: false,
      setShowWorkingOutput: (showWorkingOutput) => set({ showWorkingOutput }),
      presentationMode: "classic",
      setPresentationMode: (presentationMode) => set({ presentationMode }),
    }),
    {
      name: "farplane-chat-store",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        currentMode: state.currentMode,
        showWorkingOutput: state.showWorkingOutput,
        presentationMode: state.presentationMode,
      }),
    },
  ),
);

export function useChatActions(): {
  openEmployeeChat: (
    employeeId: string,
    optionsOrOpenDialog?: OpenEmployeeChatOptions | boolean,
    displayName?: string,
  ) => Promise<void>;
  openTeamChat: (teamId: string, openDialog?: boolean) => Promise<void>;
  createNewChat: (openDialog?: boolean) => Promise<void>;
} {
  const setThreadId = useChatStore((state) => state.setThreadId);
  const setIsChatOpen = useChatStore((state) => state.setIsChatOpen);
  const setCurrentEmployeeId = useChatStore((state) => state.setCurrentEmployeeId);
  const setCurrentTeamId = useChatStore((state) => state.setCurrentTeamId);
  const threads = useChatStore((state) => state.threads);
  const setThreads = useChatStore((state) => state.setThreads);

  return {
    async openEmployeeChat(
      employeeId: string,
      optionsOrOpenDialog: OpenEmployeeChatOptions | boolean = true,
      legacyDisplayName?: string,
    ): Promise<void> {
      const options: OpenEmployeeChatOptions =
        typeof optionsOrOpenDialog === "boolean"
          ? { openDialog: optionsOrOpenDialog, displayName: legacyDisplayName }
          : optionsOrOpenDialog;
      const openDialog = options.openDialog ?? true;
      const displayName = options.displayName;
      setCurrentEmployeeId(employeeId);
      setCurrentTeamId(null);
      const agentId = employeeId.startsWith("employee-")
        ? employeeId.slice("employee-".length)
        : null;
      if (agentId) {
        const appState = useAppStore.getState();
        const isAgentSwitch = appState.selectedAgentId !== agentId;
        appState.setSelectedAgentId(agentId);
        // Room-host conversations select a stable logical thread below; ordinary
        // employee switching keeps the existing reset behavior.
        if (isAgentSwitch && !options.conversationKey) {
          appState.setSelectedSessionKey(null);
        }
      }
      const conversationKey = options.conversationKey
        ? parseRoomHostConversationKey(options.conversationKey)
        : null;
      if (
        options.conversationKey &&
        (!conversationKey || conversationKey.hostAgentId !== agentId)
      ) {
        throw new Error("invalid_room_host_conversation_key");
      }
      const localThreadId = conversationKey
        ? roomHostLocalThreadId(conversationKey)
        : `dm-${employeeId}`;
      const existing = threads.find((thread) => thread._id === localThreadId);
      const title = displayName?.trim() ? `Chat with ${displayName.trim()}` : `Chat ${employeeId}`;
      if (existing) {
        if (existing.title !== title) {
          setThreads(
            threads.map((thread) => (thread._id === existing._id ? { ...thread, title } : thread)),
          );
        }
        setThreadId(existing._id);
        useAppStore.getState().setSelectedSessionKey(existing._id);
      } else {
        const next = {
          _id: localThreadId,
          title,
          agentId: agentId ?? undefined,
          ...(conversationKey ? { conversationKey } : {}),
        };
        setThreads([next, ...threads]);
        setThreadId(next._id);
        useAppStore.getState().setSelectedSessionKey(next._id);
      }
      if (openDialog) setIsChatOpen(true);
    },
    async openTeamChat(teamId: string, openDialog = true): Promise<void> {
      setCurrentTeamId(teamId);
      setCurrentEmployeeId(null);
      const existing = threads.find((thread) => thread._id === `team-${teamId}`);
      if (existing) {
        setThreadId(existing._id);
      } else {
        const next = { _id: `team-${teamId}`, title: `Team ${teamId}` };
        setThreads([next, ...threads]);
        setThreadId(next._id);
      }
      if (openDialog) setIsChatOpen(true);
    },
    async createNewChat(openDialog = true): Promise<void> {
      const next = createDefaultThread("New Chat");
      setThreads([next, ...threads]);
      setThreadId(next._id);
      setCurrentEmployeeId(null);
      setCurrentTeamId(null);
      if (openDialog) setIsChatOpen(true);
    },
  };
}
