import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  EXTERNAL_CONFIGURATION_ITEMS,
  LOCAL_CONFIGURATION_ITEMS,
  OPERATOR_CONFIGURATION_ITEMS,
  PROJECT_CONFIGURATION_ITEMS,
  projectConfigurationItems,
  type ConfigurationCatalogItem,
  type ProjectConfigurationFile,
} from "./configuration-catalog";
import type { RuntimeConfigForm } from "./runtime-config-settings";
import type { ConfigurationCatalogState } from "./use-configuration-catalog";

type ConfigurationOverviewPanelProps = {
  form: RuntimeConfigForm;
  projectFiles: ProjectConfigurationFile[];
  projectState: ConfigurationCatalogState;
  projectError: string | null;
  videoAnalysis: ReactNode;
  telegram: ReactNode;
  runtimeAutomation: ReactNode;
  officeAndAppearance: ReactNode;
};

/**
 * The Configs tab is the single discovery surface for operator, project, and
 * runtime configuration. Each feature keeps its typed editor in place; source
 * rows explain ownership instead of pretending every file is safely editable.
 */
export function ConfigurationOverviewPanel(props: ConfigurationOverviewPanelProps) {
  const {
    form,
    projectFiles,
    projectState,
    projectError,
    videoAnalysis,
    telegram,
    runtimeAutomation,
    officeAndAppearance,
  } = props;
  const projectItems = projectConfigurationItems(projectFiles);
  const staticSourceCount =
    OPERATOR_CONFIGURATION_ITEMS.length +
    LOCAL_CONFIGURATION_ITEMS.length +
    PROJECT_CONFIGURATION_ITEMS.length +
    EXTERNAL_CONFIGURATION_ITEMS.length;
  const sourceCount = staticSourceCount + projectItems.length;

  return (
    <section className="space-y-3" aria-labelledby="configure-farplane-heading">
      <div className="space-y-1 border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="configure-farplane-heading" className="text-xl font-semibold tracking-tight">
            Configs
          </h2>
          <Badge variant="outline">{sourceCount} named sources</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Open a feature to change its defaults. Every supported source is listed below with its
          owner and storage boundary.
        </p>
      </div>

      <ConfigurationSection
        id="config-video-analysis"
        title="Video analysis"
        description="Default model and reasoning for every new ingestion."
        summary={`${form.videoIntelligenceAnalysis.model || "gpt-5.6-terra"} · ${formatReasoningEffort(form.videoIntelligenceAnalysis.reasoningEffort)}`}
        defaultOpen
      >
        {videoAnalysis}
      </ConfigurationSection>

      <ConfigurationSection
        id="config-telegram"
        title="Telegram gateway"
        description="Routing, allowlist, and the local bridge used for founder notifications."
        summary="Bot token stays in Doppler"
      >
        {telegram}
      </ConfigurationSection>

      <ConfigurationSection
        id="config-runtime"
        title="Runtime & automation"
        description="Runtime adapter, endpoints, 15 non-secret controls, and 13 credential-readiness checks."
        summary="This Mac and browser"
      >
        {runtimeAutomation}
      </ConfigurationSection>

      <ConfigurationSection
        id="config-office"
        title="Office & appearance"
        description="Camera, layout, character rendering, theme, diagnostics, and onboarding."
        summary="This Mac and browser"
      >
        {officeAndAppearance}
      </ConfigurationSection>

      <ConfigurationSection
        id="config-project-policy"
        title="Project policy"
        description="Versioned rules, agents, automations, metrics, bindings, and feature metadata."
        summary={projectStatusLabel(projectState, projectItems.length)}
      >
        {projectState === "loading" || projectState === "idle" ? (
          <SourceStatus>Loading the versioned project configuration inventory…</SourceStatus>
        ) : null}
        {projectState === "error" ? (
          <SourceStatus destructive>
            Project configuration could not load ({projectError ?? "config_load_failed"}). Close and
            reopen Settings to retry.
          </SourceStatus>
        ) : null}
        {projectState === "ready" ? (
          <ConfigurationSourceList
            items={[...projectItems, ...PROJECT_CONFIGURATION_ITEMS]}
            emptyLabel="No project configuration files are registered for this workspace."
          />
        ) : null}
      </ConfigurationSection>

      <ConfigurationSection
        id="config-connections"
        title="Connections & credentials"
        description="Which system owns each credential or external runtime. Secrets are never read into this UI."
        summary="Doppler and runtime-owned"
      >
        <ConfigurationSourceList items={EXTERNAL_CONFIGURATION_ITEMS} />
      </ConfigurationSection>

      <details className="group rounded-md border border-border/70">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none">
          <span className="min-w-0">
            <span className="block text-sm font-medium">Complete source inventory</span>
            <span className="block text-xs text-muted-foreground">
              Every operator, browser, project, and runtime-owned configuration contract.
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t p-3">
          <InventoryGroup title="Operator configuration" items={OPERATOR_CONFIGURATION_ITEMS} />
          <InventoryGroup title="Local and browser preferences" items={LOCAL_CONFIGURATION_ITEMS} />
          <InventoryGroup
            title="Project configuration"
            items={[...projectItems, ...PROJECT_CONFIGURATION_ITEMS]}
            unavailable={projectState !== "ready"}
          />
          <InventoryGroup
            title="Credentials and external runtimes"
            items={EXTERNAL_CONFIGURATION_ITEMS}
          />
        </div>
      </details>
    </section>
  );
}

function ConfigurationSection(props: {
  id: string;
  title: string;
  description: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { id, title, description, summary, defaultOpen = false, children } = props;
  return (
    <details id={id} className="group rounded-md border border-border/70" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:content-none">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs leading-snug text-muted-foreground">{description}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden max-w-64 truncate sm:inline">{summary}</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  );
}

function InventoryGroup(props: {
  title: string;
  items: readonly ConfigurationCatalogItem[];
  unavailable?: boolean;
}) {
  const { title, items, unavailable = false } = props;
  return (
    <details className="rounded border border-border/60 bg-muted/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium marker:content-none">
        {title}
        <span className="text-xs font-normal text-muted-foreground">
          {unavailable ? "Unavailable" : `${items.length} sources`}
        </span>
      </summary>
      {unavailable ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Project sources will appear when the project inventory is available.
        </p>
      ) : (
        <ConfigurationSourceList items={items} />
      )}
    </details>
  );
}

function ConfigurationSourceList(props: {
  items: readonly ConfigurationCatalogItem[];
  emptyLabel?: string;
}) {
  const { items, emptyLabel = "No configuration sources are registered." } = props;
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="divide-y border-t border-border/70">
      {items.map((item) => (
        <li key={item.id} className="space-y-1.5 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{item.label}</p>
            <Badge variant="secondary">{item.access}</Badge>
          </div>
          <p className="text-xs leading-snug text-muted-foreground">{item.description}</p>
          <dl className="grid gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt>Scope</dt>
            <dd>{item.scope}</dd>
            <dt>Location</dt>
            <dd>
              <code className="break-all text-foreground/80">{item.location}</code>
            </dd>
            <dt>Owner</dt>
            <dd>{item.owner}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function SourceStatus(props: { children: ReactNode; destructive?: boolean }) {
  const { children, destructive = false } = props;
  return (
    <p
      className={`rounded-md border p-3 text-xs ${
        destructive
          ? "border-destructive/40 text-destructive"
          : "border-border/70 text-muted-foreground"
      }`}
      role={destructive ? "alert" : "status"}
      aria-live="polite"
    >
      {children}
    </p>
  );
}

function projectStatusLabel(state: ConfigurationCatalogState, count: number): string {
  if (state === "ready") return `${count + PROJECT_CONFIGURATION_ITEMS.length} project sources`;
  if (state === "error") return "Project source unavailable";
  return "Loading project sources…";
}

function formatReasoningEffort(value: string): string {
  if (value === "xhigh" || !value) return "Extra high";
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
