import { LocateFixed, MessageSquare, Radio } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HAIR_COLORS, PANTS_COLORS, SHIRT_COLORS, SKIN_COLORS } from "@/constants";
import {
  buildCodexPetAssetUrl,
  HATCH_PET_ATLAS,
} from "@/modules/office/components/employee/renderers/codex-pet-package";
import {
  CHARACTER_RENDERER_SETTINGS_EVENT,
  readDevCharacterRendererOverride,
  resolveEmployeeCharacterRenderer,
} from "@/modules/office/components/employee/renderers/registry";
import type {
  AvatarPalette,
  CharacterRendererConfig,
} from "@/modules/office/components/employee/renderers/types";
import { type AgentPresenceRow, STATUS_LABELS } from "../../team-panel-types";
import { formatRelativeTime } from "./overview-helpers";

type TeamMembersSectionProps = {
  highlightedEmployeeIds: Set<string>;
  presenceRows: AgentPresenceRow[];
  setHighlightedEmployeeIds: (ids: string[] | null) => void;
  onMessageAgent: (agentId: string) => void;
  onOpenAgentSession: (agentId: string) => void;
};

export function TeamMembersSection({
  highlightedEmployeeIds,
  onMessageAgent,
  onOpenAgentSession,
  presenceRows,
  setHighlightedEmployeeIds,
}: TeamMembersSectionProps): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">Persistent Agents</CardTitle>
          <span className="text-xs text-muted-foreground">runtime roster</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{presenceRows.length} total</Badge>
            <Badge variant="secondary">
              {presenceRows.filter((presence) => presence.blockedTaskCount > 0).length} blocked
            </Badge>
            <Badge variant="secondary">
              {presenceRows.filter((presence) => presence.openTaskCount > 0).length} with open work
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs tracking-normal"
              onClick={() => {
                const ids = presenceRows.map((presence) => presence.employeeId);
                setHighlightedEmployeeIds(ids);
              }}
              disabled={presenceRows.length === 0}
            >
              <LocateFixed className="h-4 w-4" />
              Locate all
            </Button>
            {highlightedEmployeeIds.size > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs tracking-normal"
                onClick={() => setHighlightedEmployeeIds(null)}
              >
                Clear Highlight
              </Button>
            ) : null}
          </div>
        </div>

        {presenceRows.length === 0 ? (
          <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            No persistent agents are assigned in this scope yet.
          </p>
        ) : (
          <div className="space-y-2">
            {presenceRows.map((presence) => (
              <article
                key={presence.employeeId}
                className="grid min-w-0 gap-4 rounded-md border bg-muted/20 p-4 transition hover:border-border hover:bg-muted/30"
              >
                <header className="grid min-w-0 gap-3 lg:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
                  <MemberPortrait presence={presence} />
                  <div className="min-w-0 self-center space-y-2">
                    <p className="break-words text-base font-semibold leading-5 [overflow-wrap:anywhere]">
                      {presence.name}
                    </p>
                    <p className="break-words font-mono text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                      {presence.roleLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {presence.liveState ? (
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {presence.liveState}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {formatRelativeTime(presence.latestOccurredAt)}
                      </Badge>
                      {presence.isCEO ? (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          CEO
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <section className="flex flex-wrap items-center gap-2 self-center lg:justify-end">
                    <IconTooltip label={`Locate ${presence.name} in the office`}>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setHighlightedEmployeeIds([presence.employeeId])}
                        aria-label={`Locate ${presence.name} in the office`}
                      >
                        <LocateFixed className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                    <IconTooltip label={`Message ${presence.name}`}>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onMessageAgent(presence.agentId)}
                        aria-label={`Message ${presence.name}`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                    <IconTooltip label={`Open ${presence.name} live session`}>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onOpenAgentSession(presence.agentId)}
                        aria-label={`Open ${presence.name} live session`}
                      >
                        <Radio className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                  </section>
                </header>

                <section className="grid min-w-0 gap-3 border-t pt-3 md:grid-cols-2 lg:ml-[6.25rem]">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Current State
                    </p>
                    <p className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
                      {presence.statusText}
                    </p>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Latest Task
                      </p>
                      {presence.latestTaskStatus ? (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {STATUS_LABELS[presence.latestTaskStatus]}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="break-words text-sm [overflow-wrap:anywhere]">
                      {presence.latestTaskTitle ?? "Available for new work"}
                    </p>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>{presence.openTaskCount} open</span>
                      <span>{presence.blockedTaskCount} blocked</span>
                      <span>{presence.completedTaskCount} done</span>
                    </div>
                  </div>
                </section>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IconTooltip({
  children,
  label,
}: {
  children: ReactElement;
  label: string;
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function MemberPortrait({ presence }: { presence: AgentPresenceRow }): ReactElement {
  const [devOverride, setDevOverride] = useState<CharacterRendererConfig | undefined>(() =>
    readDevCharacterRendererOverride(presence.employeeId),
  );
  useEffect(() => {
    setDevOverride(readDevCharacterRendererOverride(presence.employeeId));
    if (typeof window === "undefined") return undefined;
    const handleChange = () => setDevOverride(readDevCharacterRendererOverride(presence.employeeId));
    window.addEventListener(CHARACTER_RENDERER_SETTINGS_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener(CHARACTER_RENDERER_SETTINGS_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, [presence.employeeId]);

  const selectedRenderer = resolveEmployeeCharacterRenderer({
    employeeId: presence.employeeId,
    characterRenderer: presence.appearance?.characterRenderer,
    devOverride,
  });
  const label =
    selectedRenderer.id === "sprite-sheet-2d" ? "Sprite profile" : "Office profile";

  return (
    <figure className="m-0 overflow-hidden rounded-md border bg-background">
      <div className="relative grid aspect-square place-items-center bg-muted/20">
        {selectedRenderer.id === "sprite-sheet-2d" && selectedRenderer.config.source ? (
          <SpritePortrait source={selectedRenderer.config.source} name={presence.name} />
        ) : presence.avatarUrl ? (
          <img
            src={presence.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <BlockyThreePortrait presence={presence} />
        )}
      </div>
      <figcaption className="border-t px-2 py-1 text-center text-[10px] uppercase text-muted-foreground">
        {label}
      </figcaption>
    </figure>
  );
}

function SpritePortrait({
  source,
  name,
}: {
  source: NonNullable<CharacterRendererConfig["source"]>;
  name: string;
}): ReactElement {
  const atlasUrl =
    source.type === "codex-pet"
      ? buildCodexPetAssetUrl(source.petId, "spritesheet.webp")
      : source.atlasUrl;

  return (
    <div className="relative h-[82%] w-[76%] overflow-hidden" aria-label={`${name} sprite`}>
      <img
        src={atlasUrl}
        alt=""
        draggable={false}
        className="absolute left-0 top-0 max-w-none select-none"
        style={{
          width: `${HATCH_PET_ATLAS.columns * 100}%`,
          height: `${HATCH_PET_ATLAS.rows * 100}%`,
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}

function BlockyThreePortrait({ presence }: { presence: AgentPresenceRow }): ReactElement {
  const palette = useMemo(() => resolveStablePalette(presence), [presence]);
  return (
    <div className="relative h-full w-full" aria-label={`${presence.name} office profile`}>
      <span
        className="absolute left-1/2 top-[18%] h-[20%] w-[34%] -translate-x-1/2 rounded-sm"
        style={{ backgroundColor: palette.hair }}
      />
      <span
        className="absolute left-1/2 top-[28%] h-[24%] w-[38%] -translate-x-1/2 rounded-sm"
        style={{ backgroundColor: palette.skin }}
      />
      <span
        className="absolute left-1/2 top-[53%] h-[25%] w-[48%] -translate-x-1/2 rounded-sm"
        style={{ backgroundColor: palette.shirt }}
      />
      <span
        className="absolute bottom-[10%] left-1/2 h-[18%] w-[42%] -translate-x-1/2 rounded-sm"
        style={{ backgroundColor: palette.pants }}
      />
      <span className="absolute left-[38%] top-[38%] h-1.5 w-1.5 rounded-full bg-background" />
      <span className="absolute right-[38%] top-[38%] h-1.5 w-1.5 rounded-full bg-background" />
    </div>
  );
}

function resolveStablePalette(presence: AgentPresenceRow): AvatarPalette {
  const seed = `${presence.employeeId}:${presence.name}`;
  if (presence.isCEO) {
    return { hair: "#FFD700", skin: "#FF5722", shirt: "#CC2200", pants: "#8B0000" };
  }
  return {
    hair: presence.appearance?.hairColor ?? pickStableColor(`${seed}:hair`, HAIR_COLORS),
    skin: pickStableColor(`${seed}:skin`, SKIN_COLORS),
    shirt: pickStableColor(`${seed}:shirt`, SHIRT_COLORS),
    pants: pickStableColor(`${seed}:pants`, PANTS_COLORS),
  };
}

function pickStableColor(seed: string, palette: readonly string[]): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length] ?? palette[0] ?? "#888888";
}
