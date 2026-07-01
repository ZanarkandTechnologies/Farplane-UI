"use client";

import {
  Check,
  ChevronDown,
  Copy,
  KeyRound,
  MessageSquareText,
  RadioTower,
  Search,
  Settings,
  UserRoundCheck,
} from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildTelegramGatewayConfigToml,
  buildTelegramGatewayEnv,
  buildUserCommunicationActivityRows,
  DEFAULT_USER_COMMUNICATIONS_CONFIG,
  emptyTelegramGatewayState,
  filterUserCommunicationActivityRows,
  normalizeTelegramGatewayState,
  normalizeUserCommunicationsConfig,
  type TelegramGatewayState,
  type UserCommunicationActivityRow,
  type UserCommunicationRouteFilter,
  type UserCommunicationsConfig,
} from "../lib/user-communications";

const STATE_FILE_PATH = "~/.farplane/telegram-gateway/state.json";

function formatTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "--:--";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function statusVariant(
  status: UserCommunicationActivityRow["status"],
): "secondary" | "outline" | "destructive" {
  if (status === "failed") return "destructive";
  if (status === "waiting reply") return "outline";
  return "secondary";
}

function routeLabel(route: UserCommunicationActivityRow["route"]): string {
  return route;
}

export function UserCommunicationsTab(): ReactElement {
  const [config, setConfig] = useState<UserCommunicationsConfig>(
    DEFAULT_USER_COMMUNICATIONS_CONFIG,
  );
  const [gatewayState, setGatewayState] = useState<TelegramGatewayState>(
    emptyTelegramGatewayState(),
  );
  const [routeFilter, setRouteFilter] = useState<UserCommunicationRouteFilter>("all");
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [stateError, setStateError] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadConfig(): Promise<void> {
      try {
        const response = await fetch("/farplane/runtime-config", {
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(`config_${response.status}`);
        const body = (await response.json()) as {
          payload?: {
            config?: Record<string, unknown>;
            telegram?: Record<string, unknown>;
          };
        };
        if (cancelled) return;
        const runtime = body.payload?.config ?? {};
        const telegram = body.payload?.telegram ?? {};
        const botToken = telegram.botToken;
        setConfig(
          normalizeUserCommunicationsConfig({
            mainThreadId: typeof telegram.mainThreadId === "string" ? telegram.mainThreadId : "",
            stateBase: typeof runtime.stateBase === "string" ? runtime.stateBase : "",
            codexAppServerUrl:
              typeof runtime.codexAppServerUrl === "string" ? runtime.codexAppServerUrl : "",
            botTokenConfigured:
              Boolean(botToken) &&
              typeof botToken === "object" &&
              !Array.isArray(botToken) &&
              (botToken as { configured?: unknown }).configured === true,
            allowFrom: Array.isArray(telegram.allowFrom)
              ? telegram.allowFrom.map(String).join(", ")
              : "",
          }),
        );
      } finally {
        if (!cancelled) setConfigLoaded(true);
      }
    }
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!configLoaded) return;
    const normalized = normalizeUserCommunicationsConfig(config);
    const timeout = window.setTimeout(() => {
      void fetch("/farplane/runtime-config", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          config: {
            codexAppServerUrl: normalized.codexAppServerUrl,
            stateBase: normalized.stateBase,
          },
          telegram: {
            enabled: true,
            mainThreadId: normalized.mainThreadId,
            allowFrom: normalized.allowFrom,
            botToken: normalized.botToken,
            dmPolicy: "allowlist",
            groupPolicy: "allowlist",
            streamingMode: "off",
          },
        }),
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [config, configLoaded]);

  useEffect(() => {
    let cancelled = false;
    async function loadGatewayState(): Promise<void> {
      try {
        const response = await fetch("/farplane/telegram-gateway/state");
        if (!response.ok) throw new Error(`state_${response.status}`);
        const body = (await response.json()) as { state?: unknown };
        if (cancelled) return;
        setGatewayState(normalizeTelegramGatewayState(body.state));
        setStateError("");
      } catch (error) {
        if (cancelled) return;
        setGatewayState(emptyTelegramGatewayState());
        setStateError(error instanceof Error ? error.message : "state_unavailable");
      }
    }
    void loadGatewayState();
    const interval = window.setInterval(() => void loadGatewayState(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const command = useMemo(() => buildTelegramGatewayEnv(config), [config]);
  const configToml = useMemo(() => buildTelegramGatewayConfigToml(config), [config]);
  const rows = useMemo(() => buildUserCommunicationActivityRows(gatewayState), [gatewayState]);
  const visibleRows = useMemo(
    () => filterUserCommunicationActivityRows(rows, routeFilter, search),
    [rows, routeFilter, search],
  );
  const isConfigured = Boolean(
    config.mainThreadId.trim() &&
      (config.botToken.trim() || config.botTokenConfigured) &&
      config.allowFrom.trim(),
  );
  const waitingCount = rows.filter((row) => row.status === "waiting reply").length;
  const failedCount = rows.filter((row) => row.status === "failed").length;
  const deliveredCount = rows.filter((row) => row.status === "delivered").length;

  async function copyCommand(): Promise<void> {
    await window.navigator.clipboard.writeText(command);
    setCopiedCommand(true);
    window.setTimeout(() => setCopiedCommand(false), 1500);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/30">
            <MessageSquareText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold">Telegram</h3>
              <Badge variant={isConfigured ? "secondary" : "destructive"}>
                {isConfigured ? "Gateway configured" : "Config incomplete"}
              </Badge>
              <Badge variant="outline">state: local</Badge>
              {stateError ? <Badge variant="outline">state unavailable</Badge> : null}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{STATE_FILE_PATH}</div>
          </div>
        </div>
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Gateway Settings
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleContent>
          <div className="my-3 rounded-md border bg-muted/20 p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid gap-2">
                <Label htmlFor="telegram-main-thread">Main thread</Label>
                <Input
                  id="telegram-main-thread"
                  value={config.mainThreadId}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, mainThreadId: event.target.value }))
                  }
                  placeholder="thread_..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="telegram-state-base">AI Office URL</Label>
                <Input
                  id="telegram-state-base"
                  value={config.stateBase}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, stateBase: event.target.value }))
                  }
                  placeholder="http://127.0.0.1:5173"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="telegram-codex-app-server">Codex app-server URL</Label>
                <Input
                  id="telegram-codex-app-server"
                  value={config.codexAppServerUrl}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, codexAppServerUrl: event.target.value }))
                  }
                  placeholder="ws://127.0.0.1:47891"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="telegram-bot-token">Bot token</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="telegram-bot-token"
                    type="password"
                    value={config.botToken}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, botToken: event.target.value }))
                    }
                    className="pl-9"
                    placeholder={config.botTokenConfigured ? "saved in config.toml" : "bot token"}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="telegram-allow-from">Allow from</Label>
                <div className="relative">
                  <UserRoundCheck className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="telegram-allow-from"
                    value={config.allowFrom}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, allowFrom: event.target.value }))
                    }
                    className="pl-9"
                    placeholder="6413825906"
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <code className="min-w-0 overflow-hidden text-ellipsis rounded-md border bg-background px-3 py-2 text-xs">
                {command}
              </code>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={() => void copyCommand()}>
                    {copiedCommand ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copiedCommand ? "Copied" : "Copy Run Command"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Copies the local gateway command. Settings save to ~/.farplane/config.toml.
                </TooltipContent>
              </Tooltip>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Preview config.toml
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto rounded-md border bg-background p-3 text-xs">
                {configToml}
              </pre>
            </details>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap items-center gap-2 py-3">
        <Select
          value={routeFilter}
          onValueChange={(value) => setRouteFilter(value as UserCommunicationRouteFilter)}
        >
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All routes</SelectItem>
            <SelectItem value="reply">Replies</SelectItem>
            <SelectItem value="standalone">Standalone</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Search messages..."
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
          <RadioTower className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        {visibleRows.length > 0 ? (
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-[86px]">Time</TableHead>
                <TableHead>Source Thread</TableHead>
                <TableHead className="w-[170px]">Route</TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top font-mono text-xs text-muted-foreground">
                    {formatTime(row.occurredAt)}
                  </TableCell>
                  <TableCell className="min-w-[240px] whitespace-normal align-top">
                    <div className="truncate text-sm font-medium">{row.sourceThread}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      "{row.text}"
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-xs">{routeLabel(row.route)}</TableCell>
                  <TableCell className="align-top">
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-full min-h-[180px] flex-col">
            <div className="grid grid-cols-[86px_minmax(0,1fr)_170px_130px] border-b text-sm">
              <div className="px-2 py-3 font-medium">Time</div>
              <div className="px-2 py-3 font-medium">Source Thread</div>
              <div className="px-2 py-3 font-medium">Route</div>
              <div className="px-2 py-3 font-medium">Status</div>
            </div>
            <div className="grid flex-1 place-items-center px-4 py-10 text-sm text-muted-foreground">
              No Telegram gateway activity yet.
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
        <span>{gatewayState.mappings.length} mapped notifications</span>
        <span>{waitingCount} waiting replies</span>
        <span>{failedCount} failed routes</span>
        <span>{deliveredCount} delivered</span>
      </div>
    </div>
  );
}
