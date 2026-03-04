"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { User } from "lucide-react";
import { useAppStore } from "@/lib/app-store";
import type {
  AgentFileEntry,
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ChannelAccountSnapshot,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  SkillItemModel,
  SkillStatusEntry,
  SkillStatusReport,
  ToolCatalogGroup,
  ToolCatalogProfile,
  ToolsCatalogResult,
} from "@/lib/openclaw-types";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { useGateway } from "@/providers/gateway-provider";
import type { EmployeeData } from "@/lib/types";
import { UI_Z } from "@/lib/z-index";

/**
 * MANAGE AGENT MODAL
 * ==================
 * Zanarkand-style modal shell with parity tabs while backend
 * capabilities are being wired for ShellCorp.
 */
type SkillsMode = "all" | "selected" | "none";

type AgentConfigDraft = {
  primaryModel: string;
  fallbackModels: string;
  toolsProfile: string;
  toolsAllow: string[];
  toolsDeny: string[];
  skillsMode: SkillsMode;
  selectedSkills: string[];
};

type TabId = "overview" | "files" | "tools" | "skills" | "channels" | "cron";

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toCommaList(value: string[]): string {
  return value.join(", ");
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function extractAgentIdFromEmployee(employee: EmployeeData | null): string | null {
  if (!employee) return null;
  if (employee._id.startsWith("employee-")) {
    return employee._id.slice("employee-".length);
  }
  return null;
}

function resolveAgentConfigDraft(config: Record<string, unknown> | null, agentId: string): AgentConfigDraft {
  const agentsNode = config?.agents && typeof config.agents === "object" ? (config.agents as Record<string, unknown>) : {};
  const list = Array.isArray(agentsNode.list) ? agentsNode.list : [];
  const entry = list.find((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return String(row.id ?? row.agentId ?? "").trim() === agentId;
  }) as Record<string, unknown> | undefined;
  const modelNode = entry?.model;
  let primaryModel = "";
  let fallbackModels = "";
  if (typeof modelNode === "string") {
    primaryModel = modelNode;
  } else if (modelNode && typeof modelNode === "object") {
    const row = modelNode as Record<string, unknown>;
    primaryModel = String(row.primary ?? row.model ?? "");
    if (Array.isArray(row.fallbacks)) {
      fallbackModels = row.fallbacks.filter((item): item is string => typeof item === "string").join(", ");
    }
  }
  const toolsNode = entry?.tools && typeof entry.tools === "object" ? (entry.tools as Record<string, unknown>) : {};
  const toolsAllow = Array.isArray(toolsNode.alsoAllow)
    ? toolsNode.alsoAllow.filter((item): item is string => typeof item === "string")
    : [];
  const toolsDeny = Array.isArray(toolsNode.deny) ? toolsNode.deny.filter((item): item is string => typeof item === "string") : [];
  const skillsArray = Array.isArray(entry?.skills) ? entry.skills.filter((item): item is string => typeof item === "string") : null;
  const skillsMode: SkillsMode = skillsArray === null ? "all" : skillsArray.length === 0 ? "none" : "selected";
  return {
    primaryModel,
    fallbackModels,
    toolsProfile: typeof toolsNode.profile === "string" ? toolsNode.profile : "",
    toolsAllow,
    toolsDeny,
    skillsMode,
    selectedSkills: skillsArray ?? [],
  };
}

function buildNextConfig(
  currentConfig: Record<string, unknown>,
  agentId: string,
  draft: AgentConfigDraft,
): Record<string, unknown> {
  const next = cloneConfig(currentConfig);
  const root = next as Record<string, unknown>;
  const agentsNode =
    root.agents && typeof root.agents === "object" ? (root.agents as Record<string, unknown>) : ({} as Record<string, unknown>);
  const list = Array.isArray(agentsNode.list) ? (cloneConfig(agentsNode.list) as unknown[]) : [];
  const idx = list.findIndex((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return String(row.id ?? row.agentId ?? "").trim() === agentId;
  });
  const baseEntry =
    idx >= 0 && list[idx] && typeof list[idx] === "object"
      ? (cloneConfig(list[idx]) as Record<string, unknown>)
      : ({ id: agentId } as Record<string, unknown>);

  const primaryModel = draft.primaryModel.trim();
  const fallbackModels = parseCommaList(draft.fallbackModels);
  if (!primaryModel && fallbackModels.length === 0) {
    delete baseEntry.model;
  } else if (fallbackModels.length > 0) {
    baseEntry.model = { primary: primaryModel, fallbacks: fallbackModels };
  } else {
    baseEntry.model = primaryModel;
  }

  const toolsNode =
    baseEntry.tools && typeof baseEntry.tools === "object"
      ? (cloneConfig(baseEntry.tools) as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const profile = draft.toolsProfile.trim();
  if (profile) toolsNode.profile = profile;
  else delete toolsNode.profile;
  if (draft.toolsAllow.length > 0) toolsNode.alsoAllow = [...draft.toolsAllow];
  else delete toolsNode.alsoAllow;
  if (draft.toolsDeny.length > 0) toolsNode.deny = [...draft.toolsDeny];
  else delete toolsNode.deny;
  if (Object.keys(toolsNode).length > 0) baseEntry.tools = toolsNode;
  else delete baseEntry.tools;

  if (draft.skillsMode === "all") {
    delete baseEntry.skills;
  } else if (draft.skillsMode === "none") {
    baseEntry.skills = [];
  } else {
    baseEntry.skills = [...draft.selectedSkills];
  }

  if (idx >= 0) list[idx] = baseEntry;
  else list.push(baseEntry);
  agentsNode.list = list;
  root.agents = agentsNode;
  return next;
}

export function ManageAgentModal(): JSX.Element {
    const manageAgentEmployeeId = useAppStore((state) => state.manageAgentEmployeeId);
    const setManageAgentEmployeeId = useAppStore((state) => state.setManageAgentEmployeeId);
    const { employees } = useOfficeDataContext();
    const employee = employees.find((row) => row._id === manageAgentEmployeeId) ?? null;
    const isOpen = !!manageAgentEmployeeId;
  const { connected: gatewayConnected } = useGateway();
  const adapter = useOpenClawAdapter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [agentsList, setAgentsList] = useState<AgentsListResult | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<AgentIdentityResult | null>(null);
  const [toolsCatalog, setToolsCatalog] = useState<ToolsCatalogResult | null>(null);
  const [skillsReport, setSkillsReport] = useState<SkillStatusReport | null>(null);
  const [fallbackSkills, setFallbackSkills] = useState<SkillItemModel[]>([]);
  const [channelsSnapshot, setChannelsSnapshot] = useState<ChannelsStatusSnapshot | null>(null);
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<AgentConfigDraft>({
    primaryModel: "",
    fallbackModels: "",
    toolsProfile: "",
    toolsAllow: [],
    toolsDeny: [],
    skillsMode: "all",
    selectedSkills: [],
  });
  const [baseDraft, setBaseDraft] = useState<AgentConfigDraft>({
    primaryModel: "",
    fallbackModels: "",
    toolsProfile: "",
    toolsAllow: [],
    toolsDeny: [],
    skillsMode: "all",
    selectedSkills: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [filesState, setFilesState] = useState<{
    list: AgentsFilesListResult | null;
    activeName: string | null;
    baseByName: Record<string, string>;
    draftByName: Record<string, string>;
    loading: boolean;
    saving: boolean;
    error: string;
  }>({
    list: null,
    activeName: null,
    baseByName: {},
    draftByName: {},
    loading: false,
    saving: false,
    error: "",
  });

  const preferredAgentId = extractAgentIdFromEmployee(employee);
  const isDraftDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseDraft), [draft, baseDraft]);
  const activeFile = filesState.activeName ? filesState.list?.files.find((file) => file.name === filesState.activeName) ?? null : null;
  const activeFileBase = activeFile ? filesState.baseByName[activeFile.name] ?? "" : "";
  const activeFileDraft = activeFile ? filesState.draftByName[activeFile.name] ?? activeFileBase : "";
  const isActiveFileDirty = activeFile ? activeFileDraft !== activeFileBase : false;

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("overview");
    setLoadError("");
    setSaveStatus("");
    setFilesState({
      list: null,
      activeName: null,
      baseByName: {},
      draftByName: {},
      loading: false,
      saving: false,
      error: "",
    });
  }, [isOpen, preferredAgentId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function loadBootstrap(): Promise<void> {
      setIsLoading(true);
      setLoadError("");
      try {
        const [nextAgentsList, configSnapshot, nextChannels, nextCronStatus, nextCronJobs, skillItems] = await Promise.all([
          adapter.getAgentsList(),
          adapter.getConfigSnapshot(),
          adapter.getChannelsStatus(),
          adapter.getCronStatus(),
          adapter.listCronJobs(),
          adapter.listSkills().catch(() => []),
        ]);
        if (cancelled) return;
        setAgentsList(nextAgentsList);
        const pickedAgentId =
          (preferredAgentId && nextAgentsList.agents.some((agent) => agent.id === preferredAgentId) && preferredAgentId) ||
          nextAgentsList.defaultId ||
          nextAgentsList.agents[0]?.id ||
          null;
        setSelectedAgentId(pickedAgentId);
        setConfig(configSnapshot.config);
        setChannelsSnapshot(nextChannels);
        setCronStatus(nextCronStatus);
        setCronJobs(nextCronJobs);
        setFallbackSkills(skillItems);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "failed_to_load_manage_agent_modal");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadBootstrap();
    return () => {
      cancelled = true;
    };
  }, [adapter, isOpen, preferredAgentId]);

  useEffect(() => {
    if (!isOpen || !selectedAgentId) return;
    let cancelled = false;
    async function loadAgentData(): Promise<void> {
      const [nextIdentity, nextToolsCatalog, nextSkillsReport] = await Promise.all([
        adapter.getAgentIdentity(selectedAgentId),
        adapter.getToolsCatalog(selectedAgentId),
        adapter.getSkillsStatus(selectedAgentId),
      ]);
      if (cancelled) return;
      setIdentity(nextIdentity);
      setToolsCatalog(nextToolsCatalog);
      setSkillsReport(nextSkillsReport);
      const source = resolveAgentConfigDraft(config, selectedAgentId);
      setDraft(source);
      setBaseDraft(source);
      setSaveStatus("");
    }
    void loadAgentData().catch((error) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : "failed_to_load_agent_data");
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, isOpen, selectedAgentId, config]);

  useEffect(() => {
    if (!isOpen || !selectedAgentId || activeTab !== "files") return;
    if (!gatewayConnected) {
      setFilesState((current) => ({
        ...current,
        loading: false,
        error: "gateway_not_connected:agents.files.list",
      }));
      return;
    }
    if (filesState.list?.agentId === selectedAgentId) return;
    void (async () => {
      setFilesState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const list = await adapter.listAgentFiles(selectedAgentId);
        setFilesState((current) => ({
          ...current,
          list,
          activeName: list.files[0]?.name ?? null,
          loading: false,
        }));
      } catch (error) {
        setFilesState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "files_load_failed",
        }));
      }
    })();
  }, [adapter, activeTab, filesState.list?.agentId, gatewayConnected, isOpen, selectedAgentId]);

  useEffect(() => {
    if (!isOpen || activeTab !== "files" || !selectedAgentId || !filesState.activeName) return;
    if (!gatewayConnected) return;
    if (Object.hasOwn(filesState.baseByName, filesState.activeName)) return;
    void (async () => {
      setFilesState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const result = await adapter.getAgentFile(selectedAgentId, filesState.activeName as string);
        const content = result.file.content ?? "";
        setFilesState((current) => ({
          ...current,
          loading: false,
          baseByName: { ...current.baseByName, [result.file.name]: content },
          draftByName: { ...current.draftByName, [result.file.name]: content },
        }));
      } catch (error) {
        setFilesState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "file_load_failed",
        }));
      }
    })();
  }, [adapter, activeTab, filesState.activeName, filesState.baseByName, gatewayConnected, isOpen, selectedAgentId]);

  async function refreshConfigOnly(): Promise<void> {
    if (!selectedAgentId) return;
    try {
      const snapshot = await adapter.getConfigSnapshot();
      setConfig(snapshot.config);
      const nextDraft = resolveAgentConfigDraft(snapshot.config, selectedAgentId);
      setDraft(nextDraft);
      setBaseDraft(nextDraft);
      setSaveStatus("Config reloaded.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "config_reload_failed");
    }
  }

  async function refreshFilesList(): Promise<void> {
    if (!selectedAgentId) return;
    if (!gatewayConnected) {
      setFilesState((current) => ({
        ...current,
        loading: false,
        error: "gateway_not_connected:agents.files.list",
      }));
      return;
    }
    setFilesState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const list = await adapter.listAgentFiles(selectedAgentId);
      setFilesState((current) => ({
        ...current,
        list,
        loading: false,
        activeName: current.activeName && list.files.some((file) => file.name === current.activeName) ? current.activeName : list.files[0]?.name ?? null,
      }));
    } catch (error) {
      setFilesState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "files_refresh_failed",
      }));
    }
  }

  async function refreshSkills(): Promise<void> {
    if (!selectedAgentId) return;
    try {
      const report = await adapter.getSkillsStatus(selectedAgentId);
      if (report) setSkillsReport(report);
      const all = await adapter.listSkills().catch(() => []);
      setFallbackSkills(all);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "skills_refresh_failed");
    }
  }

  async function handleSaveConfig(): Promise<void> {
    if (!selectedAgentId || !config || !isDraftDirty) return;
    setIsSavingConfig(true);
    setSaveStatus("");
    try {
      const nextConfig = buildNextConfig(config, selectedAgentId, draft);
      const result = await adapter.applyConfig(nextConfig, true);
      if (!result.ok) {
        setSaveStatus(result.error ?? "config_save_failed");
        return;
      }
      setConfig(nextConfig);
      setBaseDraft(cloneConfig(draft));
      setSaveStatus("Config saved.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "config_save_failed");
    } finally {
      setIsSavingConfig(false);
    }
  }

  async function handleSaveFile(): Promise<void> {
    if (!selectedAgentId || !activeFile) return;
    if (!gatewayConnected) {
      setFilesState((current) => ({
        ...current,
        saving: false,
        error: "gateway_not_connected:agents.files.set",
      }));
      return;
    }
    const content = activeFileDraft;
    setFilesState((current) => ({ ...current, saving: true, error: "" }));
    try {
      const result = await adapter.saveAgentFile(selectedAgentId, activeFile.name, content);
      setFilesState((current) => ({
        ...current,
        saving: false,
        baseByName: { ...current.baseByName, [result.file.name]: content },
        draftByName: { ...current.draftByName, [result.file.name]: content },
        list:
          current.list && current.list.agentId === result.agentId
            ? {
                ...current.list,
                files: current.list.files.some((entry) => entry.name === result.file.name)
                  ? current.list.files.map((entry) => (entry.name === result.file.name ? (result.file as AgentFileEntry) : entry))
                  : [...current.list.files, result.file as AgentFileEntry],
              }
            : current.list,
      }));
    } catch (error) {
      setFilesState((current) => ({
        ...current,
        saving: false,
        error: error instanceof Error ? error.message : "file_save_failed",
      }));
    }
  }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && setManageAgentEmployeeId(null)}>
            <DialogContent className="sm:max-w-4xl min-h-[90vh]" style={{ zIndex: UI_Z.panelElevated }}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Manage Agent: {employee?.name ?? "Agent"}
                    </DialogTitle>
                    <DialogDescription>
                        Configure OpenClaw-backed workspace, tools, skills, channels, and cron settings.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)} className="w-full">
                    <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="files">Files</TabsTrigger>
                        <TabsTrigger value="tools">Tools</TabsTrigger>
                        <TabsTrigger value="skills">Skills</TabsTrigger>
                        <TabsTrigger value="channels">Channels</TabsTrigger>
                        <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
                    </TabsList>
                    <ScrollArea className="h-full min-h-[65vh] max-h-[65vh] mt-4 pr-3">
                        <TabsContent value="overview" className="space-y-4">
                            <OverviewPanel
                                employee={employee}
                                agentsList={agentsList}
                                selectedAgentId={selectedAgentId}
                                setSelectedAgentId={setSelectedAgentId}
                                identity={identity}
                                draft={draft}
                                setDraft={setDraft}
                                isLoading={isLoading}
                            />
                        </TabsContent>
                        <TabsContent value="files" className="space-y-4">
                            <FilesPanel
                                state={filesState}
                                setState={setFilesState}
                                activeFile={activeFile}
                                activeFileDraft={activeFileDraft}
                                isActiveFileDirty={isActiveFileDirty}
                                onSaveFile={handleSaveFile}
                                onRefreshFiles={refreshFilesList}
                            />
                        </TabsContent>
                        <TabsContent value="tools" className="space-y-4">
                            <ToolsPanel
                                draft={draft}
                                setDraft={setDraft}
                                toolsCatalog={toolsCatalog}
                                onReloadConfig={refreshConfigOnly}
                            />
                        </TabsContent>
                        <TabsContent value="skills" className="space-y-4">
                            <SkillsPanel
                                draft={draft}
                                setDraft={setDraft}
                                skillsReport={skillsReport}
                                fallbackSkills={fallbackSkills}
                                onReloadConfig={refreshConfigOnly}
                                onRefreshSkills={refreshSkills}
                            />
                        </TabsContent>
                        <TabsContent value="channels" className="space-y-4">
                            <ChannelsPanel snapshot={channelsSnapshot} />
                        </TabsContent>
                        <TabsContent value="cron" className="space-y-4">
                            <CronPanel status={cronStatus} jobs={cronJobs} selectedAgentId={selectedAgentId} />
                        </TabsContent>
                    </ScrollArea>
                </Tabs>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={() => setManageAgentEmployeeId(null)}>
                        Close
                    </Button>
                    <Button onClick={() => void handleSaveConfig()} disabled={!isDraftDirty || isSavingConfig || !selectedAgentId}>
                        {isSavingConfig ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
                {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}
                {saveStatus ? <p className="text-xs text-muted-foreground">{saveStatus}</p> : null}
            </DialogContent>
        </Dialog>
    );
}

type OverviewPanelProps = {
  employee: EmployeeData | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  setSelectedAgentId: (agentId: string) => void;
  identity: AgentIdentityResult | null;
  draft: AgentConfigDraft;
  setDraft: (next: AgentConfigDraft) => void;
  isLoading: boolean;
};

function OverviewPanel(props: OverviewPanelProps): JSX.Element {
  const selectedAgent = props.agentsList?.agents.find((agent) => agent.id === props.selectedAgentId) ?? null;
  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Agent</span>
          <select
            className="w-full rounded-md border bg-background px-2 py-2 text-sm"
            value={props.selectedAgentId ?? ""}
            onChange={(event) => props.setSelectedAgentId(event.target.value)}
            disabled={props.isLoading}
          >
            {(props.agentsList?.agents ?? []).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name ?? agent.id}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground">Default</p>
          <Badge variant={props.selectedAgentId === props.agentsList?.defaultId ? "default" : "secondary"}>
            {props.selectedAgentId === props.agentsList?.defaultId ? "default" : "non-default"}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="text-sm">
          <p className="text-muted-foreground">Identity Name</p>
          <p>{props.identity?.name ?? selectedAgent?.identity?.name ?? props.employee?.name ?? "n/a"}</p>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground">Identity Emoji</p>
          <p>{props.identity?.emoji ?? selectedAgent?.identity?.emoji ?? "n/a"}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Primary Model</span>
          <Input
            value={props.draft.primaryModel}
            onChange={(event) => props.setDraft({ ...props.draft, primaryModel: event.target.value })}
            placeholder="provider/model"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Fallback Models (comma-separated)</span>
          <Input
            value={props.draft.fallbackModels}
            onChange={(event) => props.setDraft({ ...props.draft, fallbackModels: event.target.value })}
            placeholder="provider/model, provider/model"
          />
        </label>
      </div>
    </div>
  );
}

type FilesPanelProps = {
  state: {
    list: AgentsFilesListResult | null;
    activeName: string | null;
    baseByName: Record<string, string>;
    draftByName: Record<string, string>;
    loading: boolean;
    saving: boolean;
    error: string;
  };
  setState: React.Dispatch<
    React.SetStateAction<{
      list: AgentsFilesListResult | null;
      activeName: string | null;
      baseByName: Record<string, string>;
      draftByName: Record<string, string>;
      loading: boolean;
      saving: boolean;
      error: string;
    }>
  >;
  activeFile: AgentFileEntry | null;
  activeFileDraft: string;
  isActiveFileDirty: boolean;
  onSaveFile: () => Promise<void>;
  onRefreshFiles: () => Promise<void>;
};

function FilesPanel(props: FilesPanelProps): JSX.Element {
  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Core workspace files (`AGENTS.md`, `IDENTITY.md`, `HEARTBEAT.md`, etc.) are loaded from OpenClaw.
        </p>
        <Button size="sm" variant="outline" onClick={() => void props.onRefreshFiles()} disabled={props.state.loading}>
          {props.state.loading ? "Loading..." : "Refresh"}
        </Button>
      </div>
      {props.state.list ? <p className="text-xs text-muted-foreground">Workspace: {props.state.list.workspace}</p> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
        <div className="rounded-md border p-2 space-y-1 max-h-[46vh] overflow-auto">
          {(props.state.list?.files ?? []).map((file) => (
            <button
              key={file.name}
              className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-accent ${
                props.state.activeName === file.name ? "bg-accent" : ""
              }`}
              onClick={() => props.setState((current) => ({ ...current, activeName: file.name }))}
            >
              {file.name}
            </button>
          ))}
          {(props.state.list?.files.length ?? 0) === 0 ? <p className="text-xs text-muted-foreground">No files loaded.</p> : null}
        </div>
        <div className="space-y-2">
          {props.activeFile ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="text-muted-foreground">Editing:</span> {props.activeFile.name}
                </p>
                <Button size="sm" onClick={() => void props.onSaveFile()} disabled={!props.isActiveFileDirty || props.state.saving}>
                  {props.state.saving ? "Saving..." : "Save File"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{props.activeFile.path}</p>
                {props.activeFile.missing ? <Badge variant="secondary">missing</Badge> : null}
              </div>
              <Textarea
                value={props.activeFileDraft}
                onChange={(event) =>
                  props.setState((current) => ({
                    ...current,
                    draftByName: { ...current.draftByName, [props.activeFile!.name]: event.target.value },
                  }))
                }
                className="min-h-[42vh] font-mono text-xs"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!props.isActiveFileDirty}
                  onClick={() =>
                    props.setState((current) => ({
                      ...current,
                      draftByName: { ...current.draftByName, [props.activeFile!.name]: current.baseByName[props.activeFile!.name] ?? "" },
                    }))
                  }
                >
                  Reset
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a file to edit.</p>
          )}
        </div>
      </div>
      {props.state.loading ? <p className="text-xs text-muted-foreground">Loading files...</p> : null}
      {props.state.error ? <p className="text-xs text-destructive">{props.state.error}</p> : null}
    </div>
  );
}

type ToolsPanelProps = {
  draft: AgentConfigDraft;
  setDraft: (next: AgentConfigDraft) => void;
  toolsCatalog: ToolsCatalogResult | null;
  onReloadConfig: () => Promise<void>;
};

function ToolsPanel(props: ToolsPanelProps): JSX.Element {
  const groups = props.toolsCatalog?.groups ?? [];
  const profiles = props.toolsCatalog?.profiles ?? [];
  const allToolIds = groups.flatMap((group) => group.tools.map((tool) => tool.id));
  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tool access profile + per-tool overrides. {props.draft.toolsAllow.length}/{allToolIds.length || 0} explicit allows.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              props.setDraft({
                ...props.draft,
                toolsAllow: [...new Set([...(props.draft.toolsAllow ?? []), ...allToolIds])],
                toolsDeny: [],
              })
            }
            disabled={allToolIds.length === 0}
          >
            Enable All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              props.setDraft({
                ...props.draft,
                toolsAllow: [],
                toolsDeny: [...new Set([...(props.draft.toolsDeny ?? []), ...allToolIds])],
              })
            }
            disabled={allToolIds.length === 0}
          >
            Disable All
          </Button>
          <Button size="sm" variant="outline" onClick={() => void props.onReloadConfig()}>
            Reload Config
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Tool Profile</span>
          <select
            className="w-full rounded-md border bg-background px-2 py-2 text-sm"
            value={props.draft.toolsProfile}
            onChange={(event) => props.setDraft({ ...props.draft, toolsProfile: event.target.value })}
          >
            <option value="">inherit/default</option>
            {profiles.map((profile: ToolCatalogProfile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1 text-sm">
          <span className="text-muted-foreground block">Quick Presets</span>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile: ToolCatalogProfile) => (
              <Button
                key={profile.id}
                size="sm"
                variant={props.draft.toolsProfile === profile.id ? "default" : "outline"}
                onClick={() => props.setDraft({ ...props.draft, toolsProfile: profile.id })}
              >
                {profile.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => props.setDraft({ ...props.draft, toolsProfile: "" })}>
              Inherit
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Also Allow</span>
          <Textarea
            className="min-h-28 font-mono text-xs"
            value={toCommaList(props.draft.toolsAllow)}
            onChange={(event) => props.setDraft({ ...props.draft, toolsAllow: parseCommaList(event.target.value) })}
            placeholder="tool.id, plugin.tool.id"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Deny</span>
          <Textarea
            className="min-h-28 font-mono text-xs"
            value={toCommaList(props.draft.toolsDeny)}
            onChange={(event) => props.setDraft({ ...props.draft, toolsDeny: parseCommaList(event.target.value) })}
            placeholder="tool.id, plugin.tool.id"
          />
        </label>
      </div>
      {groups.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Tool Catalog</p>
          <div className="max-h-44 overflow-auto rounded-md border p-2">
            {groups.map((group: ToolCatalogGroup) => (
              <div key={group.id} className="mb-3">
                <p className="text-xs font-medium">{group.label}</p>
                <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-2">
                  {group.tools.map((tool) => {
                    const checked = props.draft.toolsAllow.includes(tool.id);
                    return (
                      <label key={tool.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...props.draft.toolsAllow, tool.id]
                              : props.draft.toolsAllow.filter((entry) => entry !== tool.id);
                            props.setDraft({ ...props.draft, toolsAllow: [...new Set(next)] });
                          }}
                        />
                        <span>{tool.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SkillsPanelProps = {
  draft: AgentConfigDraft;
  setDraft: (next: AgentConfigDraft) => void;
  skillsReport: SkillStatusReport | null;
  fallbackSkills: SkillItemModel[];
  onReloadConfig: () => Promise<void>;
  onRefreshSkills: () => Promise<void>;
};

function SkillsPanel(props: SkillsPanelProps): JSX.Element {
  const [filter, setFilter] = useState("");
  const selected = new Set(props.draft.selectedSkills);
  const reportRows = props.skillsReport?.skills ?? [];
  const fallbackRows = props.fallbackSkills.map((entry) => ({
    name: entry.name,
    description: "",
    source: entry.scope === "agent" ? "agent-level" : "user-level",
  }));
  const merged = new Map<string, { name: string; description: string; source: string }>();
  for (const entry of reportRows) {
    merged.set(entry.name, { name: entry.name, description: entry.description, source: entry.source || "unknown" });
  }
  for (const entry of fallbackRows) {
    if (!merged.has(entry.name)) merged.set(entry.name, entry);
  }
  const filteredSkills = [...merged.values()].filter((entry) =>
    `${entry.name} ${entry.description} ${entry.source}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const userLevel = filteredSkills.filter((entry) => !entry.source.toLowerCase().includes("agent"));
  const agentLevel = filteredSkills.filter((entry) => entry.source.toLowerCase().includes("agent"));
  const toggleBatch = (skills: string[], enabled: boolean) => {
    const next = new Set(props.draft.selectedSkills);
    for (const skill of skills) {
      if (enabled) next.add(skill);
      else next.delete(skill);
    }
    props.setDraft({
      ...props.draft,
      skillsMode: "selected",
      selectedSkills: [...next],
    });
  };
  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Per-agent skill allowlist with user-level + agent-level visibility. {filteredSkills.length} shown.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void props.onReloadConfig()}>
            Reload Config
          </Button>
          <Button size="sm" variant="outline" onClick={() => void props.onRefreshSkills()}>
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={props.draft.skillsMode === "all" ? "default" : "outline"}
          onClick={() => props.setDraft({ ...props.draft, skillsMode: "all" })}
        >
          Use All
        </Button>
        <Button
          size="sm"
          variant={props.draft.skillsMode === "none" ? "default" : "outline"}
          onClick={() => props.setDraft({ ...props.draft, skillsMode: "none", selectedSkills: [] })}
        >
          Disable All
        </Button>
        <Button
          size="sm"
          variant={props.draft.skillsMode === "selected" ? "default" : "outline"}
          onClick={() => props.setDraft({ ...props.draft, skillsMode: "selected" })}
        >
          Custom
        </Button>
      </div>
      <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search skills" />
      <div className="max-h-[46vh] overflow-auto rounded-md border p-3 space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">USER-LEVEL SKILLS</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleBatch(userLevel.map((row) => row.name), true)}>
                Batch Enable
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleBatch(userLevel.map((row) => row.name), false)}>
                Batch Disable
              </Button>
            </div>
          </div>
          {userLevel.map((row) => (
            <label key={`user-${row.name}`} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={selected.has(row.name)}
                disabled={props.draft.skillsMode !== "selected"}
                onChange={(event) => {
                  const next = new Set(props.draft.selectedSkills);
                  if (event.target.checked) next.add(row.name);
                  else next.delete(row.name);
                  props.setDraft({ ...props.draft, selectedSkills: [...next], skillsMode: "selected" });
                }}
              />
              <span>{row.name}</span>
            </label>
          ))}
          {userLevel.length === 0 ? <p className="text-xs text-muted-foreground">No user-level skills found.</p> : null}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">AGENT-LEVEL SKILLS</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleBatch(agentLevel.map((row) => row.name), true)}>
                Batch Enable
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleBatch(agentLevel.map((row) => row.name), false)}>
                Batch Disable
              </Button>
            </div>
          </div>
          {agentLevel.map((row) => (
            <label key={`agent-${row.name}`} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={selected.has(row.name)}
                disabled={props.draft.skillsMode !== "selected"}
                onChange={(event) => {
                  const next = new Set(props.draft.selectedSkills);
                  if (event.target.checked) next.add(row.name);
                  else next.delete(row.name);
                  props.setDraft({ ...props.draft, selectedSkills: [...next], skillsMode: "selected" });
                }}
              />
              <span>{row.name}</span>
            </label>
          ))}
          {agentLevel.length === 0 ? <p className="text-xs text-muted-foreground">No agent-level skills found.</p> : null}
        </div>
      </div>
    </div>
  );
}

function summarizeAccounts(accounts: ChannelAccountSnapshot[]): string {
  const connected = accounts.filter((entry) => entry.connected === true || entry.running === true).length;
  return `${connected}/${accounts.length} connected`;
}

function ChannelsPanel({ snapshot }: { snapshot: ChannelsStatusSnapshot | null }): JSX.Element {
  const ordered = snapshot?.channelOrder ?? Object.keys(snapshot?.channelAccounts ?? {});
  return (
    <div className="rounded-md border p-4 space-y-2">
      <p className="text-sm text-muted-foreground">Gateway-wide channel status snapshot.</p>
      <div className="max-h-[50vh] overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-2">Channel</th>
              <th className="p-2">Accounts</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((channelId) => {
              const accounts = snapshot?.channelAccounts[channelId] ?? [];
              return (
                <tr key={channelId} className="border-b">
                  <td className="p-2">{snapshot?.channelLabels[channelId] ?? channelId}</td>
                  <td className="p-2">{accounts.length}</td>
                  <td className="p-2">{summarizeAccounts(accounts)}</td>
                </tr>
              );
            })}
            {ordered.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-2 text-muted-foreground">
                  No channel data available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CronPanel({
  status,
  jobs,
  selectedAgentId,
}: {
  status: CronStatus | null;
  jobs: CronJob[];
  selectedAgentId: string | null;
}): JSX.Element {
  const filtered = selectedAgentId ? jobs.filter((job) => job.agentId === selectedAgentId) : jobs;
  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 text-sm">
        <div>
          <p className="text-muted-foreground">Scheduler Enabled</p>
          <p>{status?.enabled ? "yes" : "no"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total Jobs</p>
          <p>{status?.jobs ?? 0}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Next Wake</p>
          <p>{status?.nextWakeAtMs ? new Date(status.nextWakeAtMs).toLocaleString() : "n/a"}</p>
        </div>
      </div>
      <div className="max-h-[46vh] overflow-auto rounded-md border p-2">
        {filtered.map((job) => (
          <div key={job.id} className="mb-2 rounded border p-2 text-sm">
            <p className="font-medium">{job.name}</p>
            <p className="text-xs text-muted-foreground">{job.description ?? job.id}</p>
            <p className="text-xs mt-1">
              {job.enabled ? "enabled" : "disabled"} · {job.sessionTarget} · {job.wakeMode}
            </p>
          </div>
        ))}
        {filtered.length === 0 ? <p className="text-xs text-muted-foreground">No cron jobs for this agent.</p> : null}
      </div>
    </div>
  );
}

