"use client";

/**
 * TIMELINE HOOK PANELS
 * ====================
 * Ownership: hook-telemetry UI module.
 * Inputs: project-local hook config from the Vite bridge plus Convex telemetry rows.
 * Outputs: per-project hook controls, event previews, and non-executing program-route previews.
 * Side effects: saves `~/.farplane/config.toml` and can invoke hook installation.
 */

import { Copy, RefreshCw, Settings2 } from "lucide-react";
import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { PlannedHookDetail } from "./planned-hook-detail";
import type { HookTelemetryEvent } from "./raw-telemetry-panel";
import { EventPreviewRow } from "./timeline-event-preview";

type HookConfigState = {
  enabled: boolean;
  includeManifestTracked: boolean;
  selectedManifestPaths: string[];
  customPatterns: string[];
};

type HookConfigResponse = {
  ok?: boolean;
  projectPath?: string;
  configPath?: string;
  manifestPath?: string;
  manifestExists?: boolean;
  manifestTracked?: string[];
  config?: HookConfigState;
  activePatterns?: string[];
  installCommand?: string;
  error?: string;
};

type HookDefinition = {
  id: string;
  name: string;
  type: string;
  status: "enabled" | "planned";
  description: string;
  events: string[];
};

type BusyState = "" | "saving" | "installing" | "reloading";

const HOOK_INSTALL_COMMAND = "npm run hooks:install";
const DEFAULT_FILE_PATTERNS = [
  "tickets/*/ticket.md",
  "tickets/*/progress.md",
  "tickets/*/program.md",
  "farplane/*.yaml",
  "farplane/*.yml",
  "farplane/*.json",
  "docs/MEMORY.md",
  "docs/LESSONS.md",
  "docs/TROUBLES.md",
  "docs/HISTORY.md",
].join("\n");

const HOOK_DEFINITIONS: HookDefinition[] = [
  {
    id: "file-change-listener",
    name: "File Change Listener",
    type: "PostToolUse",
    status: "enabled",
    description: "Captures project file edits and emits typed Farplane file events.",
    events: [
      "farplane.ticket.changed",
      "farplane.ticket.completed",
      "farplane.ticket.progress.changed",
    ],
  },
  {
    id: "stop-learning-hook",
    name: "Stop Learning Hook",
    type: "Stop",
    status: "planned",
    description:
      "Legacy self-improvement signal; kept separate while ticket-based scoring proves itself.",
    events: ["thread.stopped", "learning.candidate"],
  },
  {
    id: "skill-invocation-listener",
    name: "Skill Invocation Listener",
    type: "UserPromptSubmit",
    status: "planned",
    description:
      "Tracks skill usage so weak-skill attribution can be compared with ticket outcomes.",
    events: ["skill.invoked"],
  },
];

export function TimelineHooksPanel({ events }: { events: HookTelemetryEvent[] }): ReactElement {
  const [selectedHookId, setSelectedHookId] = useState(HOOK_DEFINITIONS[0]?.id ?? "");
  const selectedHook =
    HOOK_DEFINITIONS.find((hook) => hook.id === selectedHookId) ?? HOOK_DEFINITIONS[0];
  const fileChangeEvents = useMemo(
    () => events.filter((event) => event.hookName === "file-change-listener").slice(0, 12),
    [events],
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] overflow-hidden rounded-md border bg-background">
      <aside className="min-h-0 border-r">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium text-sm">Project Hooks</h2>
            <Badge variant="outline">{events.length} rows</Badge>
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-49px)]">
          <div className="space-y-2 p-3">
            {HOOK_DEFINITIONS.map((hook) => (
              <button
                key={hook.id}
                type="button"
                className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                  hook.id === selectedHook.id
                    ? "border-primary bg-primary/10"
                    : "bg-background hover:bg-muted/60"
                }`}
                onClick={() => setSelectedHookId(hook.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium text-sm">{hook.name}</span>
                  <Badge variant={hook.status === "enabled" ? "default" : "outline"}>
                    {hook.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Settings2 className="size-3.5" />
                  <span>{hook.type}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {hook.description}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <section className="min-h-0">
        {selectedHook.id === "file-change-listener" ? (
          <FileChangeHookDetail events={fileChangeEvents} hook={selectedHook} />
        ) : (
          <PlannedHookDetail hook={selectedHook} />
        )}
      </section>
    </div>
  );
}

function FileChangeHookDetail({
  events,
  hook,
}: {
  events: HookTelemetryEvent[];
  hook: HookDefinition;
}): ReactElement {
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<HookConfigResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customPatterns, setCustomPatterns] = useState("");
  const [includeManifestTracked, setIncludeManifestTracked] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [busyState, setBusyState] = useState<BusyState>("");
  const [message, setMessage] = useState("");

  const loadConfig = useCallback(async (): Promise<void> => {
    setBusyState("reloading");
    const response = await fetch("/farplane/hooks/config");
    const payload = (await response.json()) as HookConfigResponse;
    setData(payload);
    const config = payload.config;
    setEnabled(config?.enabled ?? true);
    setIncludeManifestTracked(config?.includeManifestTracked ?? true);
    setSelected(new Set(config?.selectedManifestPaths ?? payload.manifestTracked ?? []));
    setCustomPatterns((config?.customPatterns ?? []).join("\n"));
    setBusyState("");
  }, []);

  useEffect(() => {
    void loadConfig().catch((error) => {
      setBusyState("");
      setMessage(error instanceof Error ? error.message : "Failed to load hook config");
    });
  }, [loadConfig]);

  async function copyCommand(): Promise<void> {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(data?.installCommand ?? HOOK_INSTALL_COMMAND);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_200);
  }

  async function saveConfig(): Promise<boolean> {
    setBusyState("saving");
    setMessage("");
    try {
      const response = await fetch("/farplane/hooks/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          config: {
            enabled,
            includeManifestTracked,
            selectedManifestPaths: [...selected],
            customPatterns: customPatterns
              .split(/\r?\n|,/)
              .map((entry) => entry.trim())
              .filter(Boolean),
          },
        }),
      });
      const payload = (await response.json()) as HookConfigResponse;
      if (!response.ok || payload.ok === false)
        throw new Error(payload.error ?? "hook_config_save_failed");
      setData(payload);
      setMessage("Saved project hook config.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save hook config.");
      return false;
    } finally {
      setBusyState("");
    }
  }

  async function installHooks(): Promise<void> {
    setBusyState("installing");
    setMessage("");
    try {
      const saved = await saveConfig();
      if (!saved) return;
      const response = await fetch("/farplane/hooks/install", { method: "POST" });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        hooksPath?: string;
      };
      if (!response.ok || payload.ok === false)
        throw new Error(payload.error ?? "hook_install_failed");
      setMessage(
        `Installed hooks at ${payload.hooksPath ?? "~/.codex/hooks.json"}. Open /hooks to trust.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to install hooks.");
    } finally {
      setBusyState("");
    }
  }

  function togglePath(filePath: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm">{hook.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{hook.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={enabled ? "default" : "outline"}>
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge variant="outline">{data?.activePatterns?.length ?? 0} active patterns</Badge>
            {data?.manifestExists === false ? (
              <Badge variant="destructive">Manifest missing</Badge>
            ) : null}
            <Badge variant="outline">Trust via /hooks</Badge>
          </div>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-5">
            <section className="rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-sm">Capture</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Project-local config stored at {data?.configPath ?? "~/.farplane/config.toml"}.
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Reload hook config"
                  onClick={() =>
                    void loadConfig().catch((error) =>
                      setMessage(error instanceof Error ? error.message : "Reload failed"),
                    )
                  }
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <Label
                  htmlFor="timeline-hook-enabled"
                  className="flex items-center gap-2 rounded-md border bg-background/50 px-3 py-2 text-sm"
                >
                  <Checkbox
                    id="timeline-hook-enabled"
                    checked={enabled}
                    onCheckedChange={(value) => setEnabled(Boolean(value))}
                  />
                  Capture file events
                </Label>
                <Label
                  htmlFor="timeline-hook-manifest-enabled"
                  className="flex items-center gap-2 rounded-md border bg-background/50 px-3 py-2 text-sm"
                >
                  <Checkbox
                    id="timeline-hook-manifest-enabled"
                    checked={includeManifestTracked}
                    onCheckedChange={(value) => setIncludeManifestTracked(Boolean(value))}
                  />
                  Manifest files
                </Label>
              </div>
            </section>

            <section className="rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-sm">Farplane Manifest Files</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data?.manifestPath ?? "farplane/manifest.json"}
                  </p>
                </div>
                <Badge variant="outline">{selected.size} selected</Badge>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {(data?.manifestTracked ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No manifest files found.</p>
                ) : (
                  (data?.manifestTracked ?? []).map((filePath) => (
                    <Label
                      key={filePath}
                      htmlFor={`timeline-manifest-path-${slugId(filePath)}`}
                      className="flex min-w-0 items-center gap-2 rounded-md border bg-background/50 px-3 py-2 text-xs"
                    >
                      <Checkbox
                        id={`timeline-manifest-path-${slugId(filePath)}`}
                        checked={selected.has(filePath)}
                        onCheckedChange={() => togglePath(filePath)}
                      />
                      <span className="min-w-0 truncate font-mono">{filePath}</span>
                    </Label>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-md border p-4">
              <Label htmlFor="timeline-hook-patterns">Custom Patterns</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Comma or newline separated project-relative globs.
              </p>
              <Textarea
                id="timeline-hook-patterns"
                className="mt-3 h-[120px] resize-none font-mono text-xs"
                placeholder={DEFAULT_FILE_PATTERNS}
                value={customPatterns}
                onChange={(event) => setCustomPatterns(event.target.value)}
              />
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-md border p-4">
              <h3 className="font-medium text-sm">Install</h3>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded border bg-muted px-2 py-1.5 text-xs">
                  {data?.installCommand ?? HOOK_INSTALL_COMMAND}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Copy hook install command"
                  onClick={() => void copyCommand()}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{copied ? "Copied" : "CLI install"}</Badge>
                <Badge variant="outline">Posts to /telemetry/hooks</Badge>
              </div>
            </section>

            <section className="rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium text-sm">Recent Preview</h3>
                <Badge variant="outline">{events.length} rows</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {events.length === 0 ? (
                  <p className="rounded-md border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                    No file-change events in this filtered window.
                  </p>
                ) : (
                  events
                    .slice(0, 5)
                    .map((event) => (
                      <EventPreviewRow
                        key={event._id ?? event.eventKey ?? `${event.hookName}:${event.eventAt}`}
                        event={event}
                      />
                    ))
                )}
              </div>
            </section>

            <section className="rounded-md border p-4">
              <h3 className="font-medium text-sm">Mining routes</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Route bindings are loaded from Core in the Programs tab; this hook does not assign
                programs.
              </p>
            </section>
          </aside>
        </div>
      </ScrollArea>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-5 py-3">
        <div className="min-w-0 text-xs text-muted-foreground">
          {message ||
            "Save updates project-local capture config; install writes the global Codex hook registration."}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void saveConfig()} disabled={busyState !== ""}>
            {busyState === "saving" ? "Saving..." : "Save"}
          </Button>
          <Button onClick={() => void installHooks()} disabled={busyState !== ""}>
            {busyState === "installing" ? "Installing..." : "Save And Install"}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function slugId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "path";
}
