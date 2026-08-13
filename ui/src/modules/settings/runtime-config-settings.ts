/**
 * Runtime config settings client.
 *
 * Inputs: Settings form values for non-secret local runtime settings.
 * Outputs: sanitized config/status rows from the Vite state bridge.
 * Side effects: saves local Farplane runtime config to ~/.farplane/config.toml
 * through the bridge; credentials are environment-injected and never submitted.
 */

type SecretSource = "env" | "missing";

export type RuntimeSecretStatus = {
  configured: boolean;
  source: SecretSource;
};

export type RuntimeEnvEntry = {
  name: string;
  label: string;
  group: string;
  description: string;
  secret: boolean;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  status: RuntimeSecretStatus;
};

export type RuntimeConfigForm = {
  codexAppServerUrl: string;
  stateBase: string;
  convexSiteUrl: string;
  convexClientUrl: string;
  videoIntelligenceAnalysis: {
    model: string;
    reasoningEffort: string;
  };
  env: RuntimeEnvEntry[];
};

export function credentialSetupCommands(name: string): {
  setup: string;
  set: string;
  run: string;
} {
  return {
    setup: "doppler setup",
    set: `doppler secrets set ${name}`,
    run: "farplane run -- corepack pnpm run ui",
  };
}

type RuntimeConfigPayload = {
  config?: Partial<
    Pick<RuntimeConfigForm, "codexAppServerUrl" | "stateBase" | "convexSiteUrl" | "convexClientUrl">
  >;
  features?: {
    videoIntelligence?: {
      analysis?: Partial<RuntimeConfigForm["videoIntelligenceAnalysis"]>;
    };
  };
  env?: unknown[];
};

type RuntimeConfigResponse = {
  ok?: boolean;
  payload?: RuntimeConfigPayload;
  error?: string;
};

export const EMPTY_RUNTIME_CONFIG_FORM: RuntimeConfigForm = {
  codexAppServerUrl: "",
  stateBase: "",
  convexSiteUrl: "",
  convexClientUrl: "",
  videoIntelligenceAnalysis: {
    model: "gpt-5.6-terra",
    reasoningEffort: "xhigh",
  },
  env: [],
};

function normalizeSecretStatus(value: unknown): RuntimeSecretStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { configured: false, source: "missing" };
  }
  const row = value as Record<string, unknown>;
  const source = row.source === "env" || row.source === "missing" ? row.source : "missing";
  return {
    configured: row.configured === true,
    source,
  };
}

function normalizeRuntimeEnvEntry(value: unknown): RuntimeEnvEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) return null;
  return {
    name,
    label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : name,
    group: typeof row.group === "string" && row.group.trim() ? row.group.trim() : "Runtime config",
    description: typeof row.description === "string" ? row.description.trim() : "",
    secret: row.secret === true,
    value: typeof row.value === "string" ? row.value : "",
    placeholder: typeof row.placeholder === "string" ? row.placeholder : undefined,
    multiline: row.multiline === true,
    status: normalizeSecretStatus(row.status),
  };
}

function formFromPayload(payload: RuntimeConfigPayload | undefined): {
  form: RuntimeConfigForm;
} {
  const config = payload?.config ?? {};
  const env = Array.isArray(payload?.env)
    ? payload.env
        .map(normalizeRuntimeEnvEntry)
        .filter((entry): entry is RuntimeEnvEntry => entry !== null)
    : [];
  return {
    form: {
      ...EMPTY_RUNTIME_CONFIG_FORM,
      codexAppServerUrl: config.codexAppServerUrl ?? "",
      stateBase: config.stateBase ?? "",
      convexSiteUrl: config.convexSiteUrl ?? "",
      convexClientUrl: config.convexClientUrl ?? "",
      videoIntelligenceAnalysis: {
        model: payload?.features?.videoIntelligence?.analysis?.model ?? "gpt-5.6-terra",
        reasoningEffort: payload?.features?.videoIntelligence?.analysis?.reasoningEffort ?? "xhigh",
      },
      env,
    },
  };
}

async function parseRuntimeConfigResponse(response: Response): Promise<{
  form: RuntimeConfigForm;
}> {
  const payload = (await response.json().catch(() => ({}))) as RuntimeConfigResponse;
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "runtime_config_request_failed");
  }
  return formFromPayload(payload.payload);
}

export async function loadRuntimeConfigSettings(): Promise<{
  form: RuntimeConfigForm;
}> {
  const response = await fetch("/farplane/runtime-config", {
    headers: { accept: "application/json" },
  });
  return parseRuntimeConfigResponse(response);
}

export async function saveRuntimeConfigSettings(
  form: RuntimeConfigForm,
): Promise<{ form: RuntimeConfigForm }> {
  const response = await fetch("/farplane/runtime-config", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      config: {
        codexAppServerUrl: form.codexAppServerUrl,
        stateBase: form.stateBase,
        convexSiteUrl: form.convexSiteUrl,
        convexClientUrl: form.convexClientUrl,
      },
      features: {
        videoIntelligence: {
          analysis: form.videoIntelligenceAnalysis,
        },
      },
      env: Object.fromEntries(
        form.env
          .filter((entry) => !entry.secret)
          .map((entry) => [entry.name, entry.value.trim()] as const),
      ),
    }),
  });
  return parseRuntimeConfigResponse(response);
}
