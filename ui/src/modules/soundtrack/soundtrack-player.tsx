/**
 * FARPLANE RADIO HUD
 * ==================
 * Ownership: soundtrack playback state and compact HUD controls.
 * Inputs: the curated playlist plus operator playback/volume actions.
 * Outputs: one provider-backed radio segment that can join the office HUD rail.
 * Side effects: browser audio playback only.
 */

import {
  AlertCircle,
  Pause,
  Play,
  RadioTower,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import type React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { nextTrackIndex, previousTrackIndex, toggleMuteState } from "./player-state";
import { FARPLANE_RADIO_TRACKS } from "./playlist";

const DEFAULT_VOLUME = 0.28;

type SoundtrackContextValue = {
  currentIndex: number;
  errorText: string;
  isMuted: boolean;
  isPlaying: boolean;
  selectTrack: (index: number) => void;
  toggleMute: () => void;
  togglePlayback: () => void;
  track: (typeof FARPLANE_RADIO_TRACKS)[number];
  updateVolume: (values: number[]) => void;
  volume: number;
};

const SoundtrackContext = createContext<SoundtrackContextValue | null>(null);

export function SoundtrackProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null);
  const wantsPlaybackRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [isMuted, setIsMuted] = useState(false);
  const lastAudibleVolumeRef = useRef(DEFAULT_VOLUME);
  const [errorText, setErrorText] = useState("");
  const track = FARPLANE_RADIO_TRACKS[currentIndex];

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track.src || !wantsPlaybackRef.current) return;
    void audio.play().catch(() => {
      wantsPlaybackRef.current = false;
      setIsPlaying(false);
      setErrorText("Playback needs another click");
    });
  }, [track.src]);

  const selectTrack = (index: number): void => {
    setErrorText("");
    setCurrentIndex(index);
  };

  const togglePlayback = (): void => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      wantsPlaybackRef.current = false;
      audio.pause();
      setIsPlaying(false);
      return;
    }
    setErrorText("");
    void audio
      .play()
      .then(() => {
        wantsPlaybackRef.current = true;
        setIsPlaying(true);
      })
      .catch(() => {
        wantsPlaybackRef.current = false;
        setIsPlaying(false);
        setErrorText("Playback unavailable");
      });
  };

  const updateVolume = (values: number[]): void => {
    const nextVolume = Math.min(1, Math.max(0, values[0] ?? DEFAULT_VOLUME));
    if (nextVolume > 0) lastAudibleVolumeRef.current = nextVolume;
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  };

  const toggleMute = (): void => {
    const nextState = toggleMuteState(
      { isMuted, lastAudibleVolume: lastAudibleVolumeRef.current, volume },
      DEFAULT_VOLUME,
    );
    lastAudibleVolumeRef.current = nextState.lastAudibleVolume;
    setVolume(nextState.volume);
    setIsMuted(nextState.isMuted);
  };

  return (
    <SoundtrackContext.Provider
      value={{
        currentIndex,
        errorText,
        isMuted,
        isPlaying,
        selectTrack,
        toggleMute,
        togglePlayback,
        track,
        updateVolume,
        volume,
      }}
    >
      <audio
        ref={audioRef}
        src={track.src}
        preload={wantsPlaybackRef.current ? "metadata" : "none"}
        muted={isMuted}
        onEnded={() => selectTrack(nextTrackIndex(currentIndex, FARPLANE_RADIO_TRACKS.length))}
        onError={() => {
          wantsPlaybackRef.current = false;
          setIsPlaying(false);
          setErrorText("Track unavailable — skip to retry");
        }}
      />
      {children}
    </SoundtrackContext.Provider>
  );
}

function PlayerButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-none text-muted-foreground hover:text-foreground"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function SoundtrackHudControl({ standalone = false }: { standalone?: boolean }) {
  const soundtrack = useContext(SoundtrackContext);
  const [open, setOpen] = useState(false);
  if (!soundtrack) return null;
  const {
    currentIndex,
    errorText,
    isMuted,
    isPlaying,
    selectTrack,
    toggleMute,
    togglePlayback,
    track,
    updateVolume,
    volume,
  } = soundtrack;

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={180}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`Farplane Radio: ${errorText || track.title}, ${isPlaying ? "playing" : "paused"}`}
          aria-expanded={open}
          data-testid="office-radio-hud-trigger"
          data-playing={isPlaying ? "true" : "false"}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "pointer-events-auto relative flex size-11 touch-manipulation items-center justify-center text-muted-foreground transition-[background-color,color] hover:bg-accent hover:text-foreground focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transform-none",
            standalone && "border border-border/80 bg-card/95 shadow-lg backdrop-blur-md",
            !standalone && "border-l border-border/70",
          )}
        >
          <RadioTower aria-hidden="true" className="size-[18px]" />
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-2 right-2 size-1.5 rounded-full bg-muted-foreground/45",
              isPlaying && "motion-safe:animate-pulse bg-primary",
            )}
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="end"
        sideOffset={8}
        data-testid="office-radio-hud-card"
        className="z-[1800] w-[320px] rounded-none border-border/80 bg-card/95 p-3 text-card-foreground shadow-lg backdrop-blur-md"
      >
        <div className="flex min-w-0 items-center gap-3 border-b border-border/70 pb-3">
          <div
            aria-hidden="true"
            className={cn(
              "flex h-8 w-7 shrink-0 items-end justify-center gap-0.5 border border-primary/30 bg-primary/10 px-1 py-1",
              isPlaying && "border-primary/60",
            )}
          >
            {[45, 80, 60, 95].map((height, index) => (
              <span
                key={height}
                className={cn(
                  "w-0.5 bg-primary/60 transition-[height,background-color]",
                  isPlaying && "motion-safe:animate-pulse bg-primary",
                )}
                style={{ height: `${height - index * 4}%`, animationDelay: `${index * 110}ms` }}
              />
            ))}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Farplane Radio
            </p>
            <p aria-live="polite" className="truncate text-sm font-medium text-foreground">
              {errorText || track.title}
            </p>
          </div>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {String(currentIndex + 1).padStart(2, "0")}/{FARPLANE_RADIO_TRACKS.length}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1">
          <PlayerButton
            label="Previous track"
            onClick={() =>
              selectTrack(previousTrackIndex(currentIndex, FARPLANE_RADIO_TRACKS.length))
            }
          >
            <SkipBack aria-hidden="true" />
          </PlayerButton>
          <Button
            type="button"
            size="icon-sm"
            className="rounded-none"
            aria-label={isPlaying ? "Pause Farplane Radio" : "Play Farplane Radio"}
            onClick={togglePlayback}
          >
            {errorText.startsWith("Track unavailable") ? (
              <AlertCircle aria-hidden="true" />
            ) : isPlaying ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
          </Button>
          <PlayerButton
            label="Next track"
            onClick={() => selectTrack(nextTrackIndex(currentIndex, FARPLANE_RADIO_TRACKS.length))}
          >
            <SkipForward aria-hidden="true" />
          </PlayerButton>
          <div className="ml-auto flex items-center gap-2 border-l border-border/70 pl-2">
            <PlayerButton label={isMuted ? "Unmute" : "Mute"} onClick={toggleMute}>
              {isMuted || volume === 0 ? (
                <VolumeX aria-hidden="true" />
              ) : (
                <Volume2 aria-hidden="true" />
              )}
            </PlayerButton>
            <Slider
              aria-label="Farplane Radio volume"
              className="w-24"
              min={0}
              max={1}
              step={0.01}
              value={[isMuted ? 0 : volume]}
              onValueChange={updateVolume}
            />
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
