"use client";

import { Check, Copy, Info, KeyRound, RadioTower, Route, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildTelegramGatewayEnv,
  buildTelegramGatewayConfigJson,
  DEFAULT_USER_COMMUNICATIONS_CONFIG,
  parseUserCommunicationsConfig,
  serializeUserCommunicationsConfig,
  USER_COMMUNICATIONS_CONFIG_STORAGE_KEY,
  type UserCommunicationsConfig,
} from "../lib/user-communications";

export function UserCommunicationsTab(): ReactElement {
  const [config, setConfig] = useState<UserCommunicationsConfig>(DEFAULT_USER_COMMUNICATIONS_CONFIG);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  useEffect(() => {
    setConfig(parseUserCommunicationsConfig(window.localStorage.getItem(USER_COMMUNICATIONS_CONFIG_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(USER_COMMUNICATIONS_CONFIG_STORAGE_KEY, serializeUserCommunicationsConfig(config));
  }, [config]);

  const command = useMemo(() => buildTelegramGatewayEnv(config), [config]);
  const configJson = useMemo(() => buildTelegramGatewayConfigJson(config), [config]);
  const isConfigured = Boolean(config.mainThreadId.trim() && config.botToken.trim() && config.allowFrom.trim());

  async function copyCommand(): Promise<void> {
    await window.navigator.clipboard.writeText(command);
    setCopiedCommand(true);
    window.setTimeout(() => setCopiedCommand(false), 1500);
  }

  async function copyConfig(): Promise<void> {
    await window.navigator.clipboard.writeText(configJson);
    setCopiedConfig(true);
    window.setTimeout(() => setCopiedConfig(false), 1500);
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              Telegram Routing
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Routing details">
                  <Info className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-64">
                Replies use the notification mapping. New Telegram messages use the main thread.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={isConfigured ? "secondary" : "destructive"}>
              {isConfigured ? "main thread set" : "main thread missing"}
            </Badge>
            <Badge variant="outline">local config</Badge>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="telegram-main-thread">Main thread</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Main thread details">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Standalone Telegram messages route here.</TooltipContent>
              </Tooltip>
            </div>
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
            <div className="flex items-center gap-2">
              <Label htmlFor="telegram-bot-token">Bot token</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Bot token details">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stored in ~/.farplane/config.json.</TooltipContent>
              </Tooltip>
            </div>
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
                placeholder="bot token"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="telegram-allow-from">Allow from</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Allowlist details">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Comma-separated Telegram user or chat IDs.</TooltipContent>
              </Tooltip>
            </div>
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

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="telegram-state-base">AI Office URL</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="App server details">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>HTTP URL for the Farplane UI bridge.</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="telegram-state-base"
              value={config.stateBase}
              onChange={(event) =>
                setConfig((current) => ({ ...current, stateBase: event.target.value }))
              }
              placeholder="http://127.0.0.1:5173"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <RadioTower className="h-4 w-4 text-primary" />
              Local Gateway
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Gateway details">
                  <Info className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Run from the repo root after loading Telegram env.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <code className="block min-h-[96px] whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
            {command}
          </code>
          <Button variant="outline" className="w-full" onClick={() => void copyConfig()}>
            {copiedConfig ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copiedConfig ? "Copied" : "Copy ~/.farplane/config.json"}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => void copyCommand()}>
            {copiedCommand ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copiedCommand ? "Copied" : "Copy command"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
