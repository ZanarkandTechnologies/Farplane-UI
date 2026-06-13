import { useEffect, useState } from "react";
import {
  CodexAppServerClient,
  type CodexOfficeVisibilityConfig,
  type CodexProjectManagerPin,
} from "@/modules/runtime";
import { getGatewayUiConfig } from "@/modules/runtime";

const DEFAULT_RECENT_THREAD_WINDOW_MINUTES = 180;
const DEFAULT_MISC_PROJECT_NAME = "Misc";
const DEFAULT_MISC_PATH_INCLUDES = "Documents/Codex";

function joinLines(values: string[] | undefined): string {
  return Array.isArray(values) ? values.join("\n") : "";
}

function splitLines(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

export type CodexOfficeVisibilityForm = {
  recentMinutes: string;
  ceoThreadId: string;
  projectManagers: CodexProjectManagerPin[];
  alwaysShowHeartbeat: boolean;
  showAutomationThreads: boolean;
  heartbeatThreadIds: string;
  miscProjectName: string;
  miscPathIncludes: string;
};

function formFromConfig(config: CodexOfficeVisibilityConfig): CodexOfficeVisibilityForm {
  return {
    recentMinutes: String(config.recentThreadWindowMinutes ?? DEFAULT_RECENT_THREAD_WINDOW_MINUTES),
    ceoThreadId: config.ceoThreadId ?? config.leadershipPins?.ceoThreadId ?? "",
    projectManagers: config.projectManagers ?? config.leadershipPins?.projectManagers ?? [],
    alwaysShowHeartbeat: config.alwaysShowHeartbeatThreads !== false,
    showAutomationThreads: config.showAutomationThreadsAsHeartbeat !== false,
    heartbeatThreadIds: joinLines(config.heartbeatThreadIds),
    miscProjectName: config.miscProjectName ?? DEFAULT_MISC_PROJECT_NAME,
    miscPathIncludes: joinLines(config.miscPathIncludes) || DEFAULT_MISC_PATH_INCLUDES,
  };
}

function configFromForm(form: CodexOfficeVisibilityForm): CodexOfficeVisibilityConfig {
  const recentThreadWindowMinutes = Number(form.recentMinutes);
  return {
    recentThreadWindowMinutes:
      Number.isFinite(recentThreadWindowMinutes) && recentThreadWindowMinutes > 0
        ? recentThreadWindowMinutes
        : DEFAULT_RECENT_THREAD_WINDOW_MINUTES,
    ceoThreadId: form.ceoThreadId.trim() || undefined,
    projectManagers: form.projectManagers,
    leadershipPins: {
      ceoThreadId: form.ceoThreadId.trim() || undefined,
      projectManagers: form.projectManagers,
    },
    alwaysShowHeartbeatThreads: form.alwaysShowHeartbeat,
    showAutomationThreadsAsHeartbeat: form.showAutomationThreads,
    heartbeatThreadIds: splitLines(form.heartbeatThreadIds),
    miscProjectName: form.miscProjectName.trim() || DEFAULT_MISC_PROJECT_NAME,
    miscPathIncludes: splitLines(form.miscPathIncludes),
  };
}

export function useCodexOfficeVisibilitySettings(input: {
  dialogOpen: boolean;
  stateBaseInput: string;
  refreshOfficeData: () => Promise<void>;
}) {
  const { dialogOpen, stateBaseInput, refreshOfficeData } = input;
  const [form, setForm] = useState<CodexOfficeVisibilityForm>(() => formFromConfig({}));
  const [statusText, setStatusText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!dialogOpen) return;
    const client = new CodexAppServerClient({ stateUrl: getGatewayUiConfig().stateBase });
    let cancelled = false;
    setStatusText("");
    client
      .readOfficeVisibilityConfig()
      .then((config) => {
        if (!cancelled) setForm(formFromConfig(config));
      })
      .catch((error) => {
        if (cancelled) return;
        setStatusText(
          error instanceof Error ? error.message : "Failed to load Codex office settings.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen]);

  async function save(nextForm: CodexOfficeVisibilityForm = form): Promise<void> {
    setIsSaving(true);
    setStatusText("");
    try {
      const client = new CodexAppServerClient({ stateUrl: stateBaseInput });
      const saved = await client.saveOfficeVisibilityConfig(configFromForm(nextForm));
      setForm(formFromConfig(saved));
      await refreshOfficeData();
      setStatusText("Codex office settings saved.");
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "Failed to save Codex office settings.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return {
    form,
    setForm,
    statusText,
    setStatusText,
    isSaving,
    save,
  };
}
