/**
 * Runtime config settings client.
 *
 * Inputs: Settings form values for local runtime URLs and API keys.
 * Outputs: sanitized config/status rows from the Vite state bridge.
 * Side effects: saves non-secret config to ~/.farplane/config.json and secrets
 * to the local secrets store through the bridge; secret values are never read
 * back into the browser.
 */

type SecretSource = "saved" | "env" | "missing";

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
  meshyApiKey: string;
  notionApiKey: string;
  telemetryToken: string;
  env: RuntimeEnvEntry[];
};

export type RuntimeConfigStatus = {
  meshyApiKey: RuntimeSecretStatus;
  notionApiKey: RuntimeSecretStatus;
  telemetryToken: RuntimeSecretStatus;
};

type RuntimeConfigPayload = {
  config?: Partial<
    Pick<
      RuntimeConfigForm,
      "codexAppServerUrl" | "stateBase" | "convexSiteUrl" | "convexClientUrl"
    >
  >;
  secrets?: Partial<RuntimeConfigStatus>;
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
  meshyApiKey: "",
  notionApiKey: "",
  telemetryToken: "",
  env: [],
};

export const EMPTY_RUNTIME_CONFIG_STATUS: RuntimeConfigStatus = {
  meshyApiKey: { configured: false, source: "missing" },
  notionApiKey: { configured: false, source: "missing" },
  telemetryToken: { configured: false, source: "missing" },
};

function normalizeSecretStatus(value: unknown): RuntimeSecretStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { configured: false, source: "missing" };
  }
  const row = value as Record<string, unknown>;
  const source =
    row.source === "saved" || row.source === "env" || row.source === "missing"
      ? row.source
      : "missing";
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
    group:
      typeof row.group === "string" && row.group.trim()
        ? row.group.trim()
        : "Runtime config",
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
  status: RuntimeConfigStatus;
} {
  const config = payload?.config ?? {};
  const secrets = payload?.secrets ?? {};
  const env = Array.isArray(payload?.env)
    ? payload.env.map(normalizeRuntimeEnvEntry).filter((entry): entry is RuntimeEnvEntry => entry !== null)
    : [];
  return {
    form: {
      ...EMPTY_RUNTIME_CONFIG_FORM,
      codexAppServerUrl: config.codexAppServerUrl ?? "",
      stateBase: config.stateBase ?? "",
      convexSiteUrl: config.convexSiteUrl ?? "",
      convexClientUrl: config.convexClientUrl ?? "",
      env,
    },
    status: {
      meshyApiKey: normalizeSecretStatus(secrets.meshyApiKey),
      notionApiKey: normalizeSecretStatus(secrets.notionApiKey),
      telemetryToken: normalizeSecretStatus(secrets.telemetryToken),
    },
  };
}

async function parseRuntimeConfigResponse(response: Response): Promise<{
  form: RuntimeConfigForm;
  status: RuntimeConfigStatus;
}> {
  const payload = (await response.json().catch(() => ({}))) as RuntimeConfigResponse;
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "runtime_config_request_failed");
  }
  return formFromPayload(payload.payload);
}

export async function loadRuntimeConfigSettings(): Promise<{
  form: RuntimeConfigForm;
  status: RuntimeConfigStatus;
}> {
  const response = await fetch("/farplane/runtime-config", {
    headers: { accept: "application/json" },
  });
  return parseRuntimeConfigResponse(response);
}

export async function saveRuntimeConfigSettings(
  form: RuntimeConfigForm,
): Promise<{ form: RuntimeConfigForm; status: RuntimeConfigStatus }> {
  const secrets: Partial<
    Pick<RuntimeConfigForm, "meshyApiKey" | "notionApiKey" | "telemetryToken">
  > = {};
  if (form.meshyApiKey.trim()) secrets.meshyApiKey = form.meshyApiKey.trim();
  if (form.notionApiKey.trim()) secrets.notionApiKey = form.notionApiKey.trim();
  if (form.telemetryToken.trim()) secrets.telemetryToken = form.telemetryToken.trim();

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
      env: Object.fromEntries(
        form.env
          .filter((entry) => !entry.secret || entry.value.trim().length > 0)
          .map((entry) => [entry.name, entry.value.trim()] as const),
      ),
      secrets,
    }),
  });
  return parseRuntimeConfigResponse(response);
}
