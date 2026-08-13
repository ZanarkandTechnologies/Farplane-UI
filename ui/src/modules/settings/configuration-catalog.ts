export type ConfigurationAccess =
  | "Edit in this section"
  | "Feature-owned editor"
  | "File or CLI only"
  | "Read-only"
  | "Secret readiness only"
  | "Runtime-owned"
  | "Version-controlled file"
  | "Template source";

export type ConfigurationCatalogItem = {
  id: string;
  label: string;
  description: string;
  scope: string;
  location: string;
  owner: string;
  access: ConfigurationAccess;
};

export type ProjectConfigurationFile = {
  id: string;
  path: string;
  title: string;
  format: "json" | "markdown" | "toml" | "yaml";
  exists: boolean;
  error?: string;
};

export const OPERATOR_CONFIGURATION_ITEMS: readonly ConfigurationCatalogItem[] = [
  {
    id: "operator-video-intelligence",
    label: "Video Intelligence analysis",
    description: "Default model and reasoning effort snapshotted by each new video analysis.",
    scope: "This Mac",
    location: "~/.farplane/config.toml [features.video_intelligence.analysis]",
    owner: "Feature defaults",
    access: "Edit in this section",
  },
  {
    id: "operator-runtime-endpoints",
    label: "Runtime endpoints",
    description: "Non-secret URLs for the Codex app server, local state bridge, and Convex.",
    scope: "This Mac",
    location: "~/.farplane/config.toml [runtime] + [convex]",
    owner: "Runtime & automation",
    access: "Edit in this section",
  },
  {
    id: "operator-runtime-automation",
    label: "Runtime automation and review controls",
    description:
      "15 non-secret environment-backed controls for hooks, Vite-safe URLs, review behavior, and automation.",
    scope: "This Mac",
    location: "~/.farplane/config.toml [env]",
    owner: "Runtime & automation",
    access: "Edit in this section",
  },
  {
    id: "operator-telegram",
    label: "Telegram gateway",
    description: "Routing and streaming behavior; the bot token stays secret and status-only.",
    scope: "This Mac",
    location: "~/.farplane/config.toml [telegram]",
    owner: "Communications",
    access: "Edit in this section",
  },
  {
    id: "operator-file-change-hooks",
    label: "File-change listener",
    description:
      "Hook listener controls. Despite the old label, this is one machine-local setting.",
    scope: "This Mac",
    location: "~/.farplane/config.toml [hooks.file_change]",
    owner: "Hook Telemetry",
    access: "Feature-owned editor",
  },
  {
    id: "operator-slash-finance",
    label: "Slash finance integration",
    description: "Non-secret Slash base URL and legal-entity identifier for finance collection.",
    scope: "This Mac",
    location: "~/.farplane/config.toml [integrations.slash]",
    owner: "Finance CLI",
    access: "File or CLI only",
  },
];

export const LOCAL_CONFIGURATION_ITEMS: readonly ConfigurationCatalogItem[] = [
  {
    id: "office-view-layout",
    label: "Office view and layout kit",
    description: "Camera, layout, and office appearance preferences for this operator.",
    scope: "This Mac",
    location: "~/.farplane/office.json",
    owner: "Office View",
    access: "Feature-owned editor",
  },
  {
    id: "codex-office-visibility",
    label: "Codex office visibility",
    description: "Worker visibility, lifetime, and the Misc project grouping for the Codex office.",
    scope: "This Mac",
    location: "~/.farplane/office.json.codex (legacy: codex-office.json)",
    owner: "Codex runtime",
    access: "Edit in this section",
  },
  {
    id: "runtime-adapter",
    label: "Runtime adapter",
    description: "Chooses the Codex or OpenClaw adapter for this browser profile.",
    scope: "This browser",
    location: "localStorage farplane.runtime-adapter.v1",
    owner: "Runtime",
    access: "Edit in this section",
  },
  {
    id: "gateway-ui",
    label: "OpenClaw gateway UI",
    description:
      "Gateway URL, state URL, default session, and language; tokens are environment-only.",
    scope: "This browser",
    location: "localStorage farplane.gateway-config.v1",
    owner: "OpenClaw runtime",
    access: "Edit in this section",
  },
  {
    id: "general-preferences",
    label: "Theme, debug, builder, and onboarding",
    description: "Browser-local operating preferences; theme storage is owned by next-themes.",
    scope: "This browser",
    location: "browser storage + app store",
    owner: "General settings",
    access: "Edit in this section",
  },
  {
    id: "office-character-graphics",
    label: "Office character graphics",
    description: "Optional local renderer and sprite overrides for office characters.",
    scope: "This browser",
    location: "localStorage farplane.office.characterSprite*",
    owner: "Office View",
    access: "Edit in this section",
  },
  {
    id: "video-user-profile",
    label: "Video Intelligence operator profile",
    description: "Personalization context for the local video-analysis agent.",
    scope: "This Mac",
    location: "~/.farplane/USER.md",
    owner: "Local video agent",
    access: "File or CLI only",
  },
  {
    id: "team-resources",
    label: "Team resources",
    description: "Project-scoped local resource notes used by team commands.",
    scope: "This Mac + project",
    location: "~/.farplane/projects/<projectId>/RESOURCES.md",
    owner: "Team CLI",
    access: "File or CLI only",
  },
  {
    id: "legacy-farplane-shell",
    label: "Legacy Farplane shell config",
    description: "Compatibility-only Convex site URL state; do not add new settings here.",
    scope: "This Mac",
    location: "~/.farplane/farplane.json",
    owner: "Onboarding compatibility",
    access: "Read-only",
  },
  {
    id: "developer-bootstrap",
    label: "Developer bootstrap environment",
    description:
      "Checkout-local non-secret bootstrap values used by onboarding and Vite; not an operator-default store.",
    scope: "This checkout",
    location: ".env.local + ui/.env.local",
    owner: "Onboarding CLI",
    access: "File or CLI only",
  },
  {
    id: "office-onboarding",
    label: "Office onboarding completion",
    description: "Whether this browser has completed the office tour.",
    scope: "This browser",
    location: "localStorage farplane.office-onboarding.completed",
    owner: "General settings",
    access: "Edit in this section",
  },
  {
    id: "chat-preferences",
    label: "Chat presentation preferences",
    description: "Local chat sidebar, working-output, and presentation-mode preferences.",
    scope: "This browser",
    location: "localStorage farplane-chat-store",
    owner: "Chat",
    access: "Feature-owned editor",
  },
  {
    id: "developer-diagnostic-overrides",
    label: "Developer diagnostic overrides",
    description:
      "Pathfinding, gateway, and office-refresh debug flags for local troubleshooting only.",
    scope: "This browser",
    location:
      "localStorage farplane.debug.pathfinding + farplane.debug.gateway + farplane.debug.officeRefresh",
    owner: "Developer diagnostics",
    access: "File or CLI only",
  },
];

const PROJECT_FILE_ACCESS: Record<
  string,
  Pick<ConfigurationCatalogItem, "owner" | "access" | "description">
> = {
  "farplane/brand.yaml": {
    owner: "Resource Bank → Brand Kits",
    access: "Feature-owned editor",
    description: "Default Brand Kit selection for this project.",
  },
  "farplane/pm.json": {
    owner: "Project PM bridge",
    access: "Read-only",
    description: "Project-manager policy is bridge-backed; no active editor is mounted.",
  },
};

export function projectConfigurationItems(
  files: readonly ProjectConfigurationFile[],
): ConfigurationCatalogItem[] {
  return files.map((file) => {
    const override = PROJECT_FILE_ACCESS[file.path];
    return {
      id: `project-${file.id}`,
      label: file.title,
      description:
        override?.description ??
        `Versioned ${file.format.toUpperCase()} project policy read by the Project Config workspace.`,
      scope: "This project",
      location: file.path,
      owner: override?.owner ?? "Project Config workspace",
      access: override?.access ?? "Version-controlled file",
    };
  });
}

export const PROJECT_CONFIGURATION_ITEMS: readonly ConfigurationCatalogItem[] = [
  {
    id: "project-dashboard-runtime-sources",
    label: "Dashboard runtime sources",
    description: "Configures where the project dashboard discovers runtime data.",
    scope: "This project",
    location: "farplane/dashboard-runtime-sources.json",
    owner: "Project dashboard",
    access: "Version-controlled file",
  },
  {
    id: "skill-package-manifests",
    label: "Skill package manifests",
    description: "Per-skill package contracts for Skill OS and the skill registry.",
    scope: "This project",
    location: "skills/**/skill.config.yaml",
    owner: "Skill OS",
    access: "Feature-owned editor",
  },
  {
    id: "configuration-templates",
    label: "Configuration templates",
    description:
      "Tracked templates are source material, not live configuration until materialized.",
    scope: "This project",
    location: "templates/**",
    owner: "Template Tracking",
    access: "Template source",
  },
];

export const EXTERNAL_CONFIGURATION_ITEMS: readonly ConfigurationCatalogItem[] = [
  {
    id: "doppler-secrets",
    label: "Doppler credentials",
    description: "API keys, tokens, OAuth material, and signing keys. Values never enter this UI.",
    scope: "Process environment",
    location: "Doppler → injected environment",
    owner: "Doppler",
    access: "Secret readiness only",
  },
  {
    id: "openclaw-runtime",
    label: "OpenClaw runtime config",
    description:
      "OpenClaw-owned configuration and device authentication; use its own vetted controls.",
    scope: "This Mac",
    location: "~/.openclaw/openclaw.json",
    owner: "OpenClaw",
    access: "Runtime-owned",
  },
  {
    id: "openclaw-device-credentials",
    label: "OpenClaw device identity and authorization",
    description:
      "The browser holds an OpenClaw device key and authorization tokens; Farplane must not expose or edit them.",
    scope: "This browser",
    location: "localStorage openclaw-device-identity-v1 + openclaw.device.auth.v1",
    owner: "OpenClaw",
    access: "Runtime-owned",
  },
  {
    id: "codex-global-state",
    label: "Codex global state",
    description:
      "Codex-owned workspace, project, and pin state; Farplane reads but does not edit it.",
    scope: "This Mac",
    location: "~/.codex/.codex-global-state.json",
    owner: "Codex",
    access: "Runtime-owned",
  },
];
