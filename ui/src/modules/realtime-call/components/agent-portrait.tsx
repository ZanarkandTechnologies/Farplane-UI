/**
 * Ownership: visual identity and speaking feedback for agents inside realtime calls.
 * Inputs: a project agent profile plus optional LiveKit participant/audio state.
 * Side effects: reads LiveKit speaking and waveform state; renders no media itself.
 */
import { useAudioWaveform, useIsSpeaking, type useTracks } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { Sparkles, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectAgentProfile } from "../types";
import { AgentFace } from "./agent-face";

export type AudioTrackReference = ReturnType<typeof useTracks>[number];

const WAVEFORM_BAR_IDS = ["one", "two", "three", "four", "five", "six", "seven"] as const;

function displayName(profile: ProjectAgentProfile): string {
  return profile.name?.trim() || profile.agentId;
}

function initials(profile: ProjectAgentProfile): string {
  return displayName(profile)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AgentPortrait({
  profile,
  inRoom = false,
  isSpeaking = false,
  bars = [],
  level = 0,
}: {
  profile: ProjectAgentProfile;
  inRoom?: boolean;
  isSpeaking?: boolean;
  bars?: number[];
  level?: number;
}): React.JSX.Element {
  const portrait = profile.portraitUrl || profile.portrait;

  return (
    <article
      className={cn(
        "relative min-h-[clamp(22rem,54vh,38rem)] overflow-hidden rounded-2xl border bg-card shadow-sm transition-[border-color,box-shadow]",
        isSpeaking && "border-primary/70 shadow-md ring-1 ring-primary/30",
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background/20 to-background" />
      <div className="relative flex h-full flex-col items-center justify-center gap-3 p-5">
        <Badge
          variant="secondary"
          className="absolute left-3 top-3 gap-1 text-[10px] uppercase tracking-wide"
        >
          <Sparkles className="size-3" aria-hidden="true" /> Local override
        </Badge>
        {profile.appearance ? (
          <AgentFace
            profile={profile}
            isSpeaking={isSpeaking}
            level={level}
            className="size-[clamp(11rem,19vw,19rem)] drop-shadow-xl"
          />
        ) : (
          <Avatar
            className={cn(
              "size-[clamp(11rem,19vw,19rem)] border-4 border-background shadow-xl",
              isSpeaking && "ring-2 ring-primary/70",
            )}
          >
            {portrait ? (
              <AvatarImage
                src={portrait}
                alt={displayName(profile)}
                className="object-cover"
                width={112}
                height={112}
                loading="lazy"
              />
            ) : null}
            <AvatarFallback className="text-2xl font-semibold">
              {initials(profile) || <UserRound aria-hidden="true" />}
            </AvatarFallback>
          </Avatar>
        )}
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-7 rounded-full bg-foreground/70 transition-transform",
            isSpeaking && "motion-safe:animate-pulse",
          )}
          style={{ transform: `scaleY(${isSpeaking ? Math.max(1.4, 1 + level * 8) : 1})` }}
        />
        <div className="text-center">
          <h3 className="text-xl font-semibold">{displayName(profile)}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.title || (inRoom ? "In call" : "Ready")}
          </p>
        </div>
        <div className="flex h-7 items-end gap-1" aria-hidden="true">
          {WAVEFORM_BAR_IDS.map((barId, index) => (
            <span
              // The LiveKit analyser owns these values; CSS only smooths their presentation.
              key={barId}
              className="h-[26px] w-1 origin-bottom rounded-full bg-primary transition-[transform,opacity] duration-75"
              style={{
                transform: `scaleY(${Math.max(0.12, bars[index] ?? 0)})`,
                opacity: isSpeaking ? 0.9 : 0.28,
              }}
            />
          ))}
        </div>
        <span className="sr-only" aria-live="polite">
          {isSpeaking ? `${displayName(profile)} is speaking` : ""}
        </span>
      </div>
    </article>
  );
}

export function LiveAgentPortrait({
  profile,
  participant,
  audioTrack,
}: {
  profile: ProjectAgentProfile;
  participant: Participant;
  audioTrack?: AudioTrackReference;
}): React.JSX.Element {
  const isSpeaking = useIsSpeaking(participant);
  const { bars } = useAudioWaveform(audioTrack, {
    barCount: 7,
    updateInterval: 80,
    volMultiplier: 2,
  });

  return (
    <AgentPortrait
      profile={profile}
      inRoom
      isSpeaking={isSpeaking}
      bars={bars}
      level={participant.audioLevel ?? 0}
    />
  );
}
