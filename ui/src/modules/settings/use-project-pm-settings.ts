/**
 * Project PM settings bridge.
 *
 * Owns the dialog-local draft for project `farplane/pm.json` bindings. The
 * hook keeps server IO at the edge, exposes lane helpers to UI panels, and
 * refreshes the office model after saves so PM folding updates immediately.
 */

import { useEffect, useMemo, useState } from "react";
import {
  CodexAppServerClient,
  type CodexProjectPmConfig,
  type CodexProjectPmThreads,
  type CodexThread,
} from "@/modules/runtime";

export type ProjectPmOption = {
  projectId: string;
  name: string;
  projectPath: string;
};

function normalizeThreads(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean),
    ),
  ];
}

function normalizePmThreads(
  value: CodexProjectPmConfig["threads"],
): Required<CodexProjectPmThreads> {
  if (Array.isArray(value)) {
    return { chats: normalizeThreads(value), automations: [] };
  }
  return {
    chats: normalizeThreads(value?.chats),
    automations: normalizeThreads(value?.automations),
  };
}

function defaultProjectPmName(projectName?: string): string {
  const name = projectName?.trim();
  return name ? `${name} PM` : "Project PM";
}

function defaultPmConfig(projectName?: string): CodexProjectPmConfig {
  return {
    version: 1,
    name: defaultProjectPmName(projectName),
    role: "founder_operator",
    threads: { chats: [], automations: [] },
  };
}

export function useProjectPmSettings(input: {
  dialogOpen: boolean;
  stateBaseInput: string;
  projectOptions: ProjectPmOption[];
  refreshOfficeData: () => Promise<void>;
}) {
  const { dialogOpen, stateBaseInput, projectOptions, refreshOfficeData } = input;
  const [selectedProjectPath, setSelectedProjectPath] = useState("");
  const [pmConfig, setPmConfig] = useState<CodexProjectPmConfig>(() => defaultPmConfig());
  const [threads, setThreads] = useState<CodexThread[]>([]);
  const [statusText, setStatusText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const selectedProject = useMemo(
    () => projectOptions.find((project) => project.projectPath === selectedProjectPath) ?? null,
    [projectOptions, selectedProjectPath],
  );

  const pmThreads = useMemo(() => normalizePmThreads(pmConfig.threads), [pmConfig.threads]);
  const pinnedThreadIds = useMemo(
    () => [...new Set([...pmThreads.chats, ...pmThreads.automations])],
    [pmThreads],
  );

  useEffect(() => {
    if (!dialogOpen) return;
    const firstProjectPath = projectOptions[0]?.projectPath ?? "";
    setSelectedProjectPath((current) =>
      current && projectOptions.some((project) => project.projectPath === current)
        ? current
        : firstProjectPath,
    );
  }, [dialogOpen, projectOptions]);

  useEffect(() => {
    if (!dialogOpen) return;
    let cancelled = false;
    const client = new CodexAppServerClient({ stateUrl: stateBaseInput });
    async function loadThreads(): Promise<void> {
      try {
        const response = await client.listThreads(100);
        if (!cancelled) setThreads(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        if (!cancelled) {
          setStatusText(error instanceof Error ? error.message : "Failed to load Codex threads.");
        }
      }
    }
    void loadThreads();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, stateBaseInput]);

  useEffect(() => {
    if (!dialogOpen || !selectedProjectPath) return;
    let cancelled = false;
    const client = new CodexAppServerClient({ stateUrl: stateBaseInput });
    async function loadProjectPm(): Promise<void> {
      setIsLoading(true);
      setStatusText("");
      try {
        const loaded = await client.readProjectPmConfig(selectedProjectPath);
        if (!cancelled) setPmConfig(loaded ?? defaultPmConfig(selectedProject?.name));
      } catch (error) {
        if (!cancelled) {
          setPmConfig(defaultPmConfig(selectedProject?.name));
          setStatusText(error instanceof Error ? error.message : "Failed to load PM threads.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadProjectPm();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, selectedProject?.name, selectedProjectPath, stateBaseInput]);

  function setPinnedThread(
    threadId: string,
    lane: keyof CodexProjectPmThreads,
    pinned: boolean,
  ): void {
    const cleanThreadId = threadId.trim();
    if (!cleanThreadId) return;
    setPmConfig((config) => {
      const current = normalizePmThreads(config.threads);
      const chats = new Set(current.chats);
      const automations = new Set(current.automations);
      chats.delete(cleanThreadId);
      automations.delete(cleanThreadId);
      if (pinned) {
        if (lane === "automations") automations.add(cleanThreadId);
        else chats.add(cleanThreadId);
      }
      return {
        ...config,
        threads: { chats: [...chats], automations: [...automations] },
      };
    });
  }

  async function createChatThread(): Promise<void> {
    if (!selectedProjectPath || isCreatingThread) return;
    setIsCreatingThread(true);
    setStatusText("Creating Codex chat thread...");
    try {
      const client = new CodexAppServerClient({ stateUrl: stateBaseInput });
      const started = await client.startProjectThread(selectedProjectPath);
      const thread = started.thread;
      if (!thread?.id) {
        setStatusText("Codex did not return a new thread id.");
        return;
      }
      setThreads((current) => [thread, ...current.filter((entry) => entry.id !== thread.id)]);
      setPinnedThread(thread.id, "chats", true);
      setStatusText("New chat thread created and pinned.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Failed to create chat thread.");
    } finally {
      setIsCreatingThread(false);
    }
  }

  async function save(): Promise<void> {
    if (!selectedProjectPath || isSaving) return;
    setIsSaving(true);
    setStatusText("");
    try {
      const client = new CodexAppServerClient({ stateUrl: stateBaseInput });
      const saved = await client.saveProjectPmConfig(selectedProjectPath, {
        ...pmConfig,
        version: 1,
        threads: pmThreads,
      });
      setPmConfig(saved);
      await refreshOfficeData();
      setStatusText("Project PM threads saved.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Failed to save PM threads.");
    } finally {
      setIsSaving(false);
    }
  }

  return {
    projectOptions,
    selectedProject,
    selectedProjectPath,
    setSelectedProjectPath,
    pmConfig,
    pmThreads,
    pinnedThreadIds,
    setPinnedThread,
    threads,
    statusText,
    isSaving,
    isCreatingThread,
    isLoading,
    createChatThread,
    save,
  };
}
