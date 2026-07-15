import { AlertCircle, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { nextTrackIndex, previousTrackIndex, toggleMuteState } from "./player-state";
import { FARPLANE_RADIO_TRACKS } from "./playlist";

const DEFAULT_VOLUME = 0.28;

type PlayerButtonProps = {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

function PlayerButton({ label, onClick, children }: PlayerButtonProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 text-muted-foreground hover:text-foreground"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function SoundtrackPlayer(): React.JSX.Element {
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
    <section
      data-testid="farplane-radio"
      aria-label="Farplane Radio"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[80] flex justify-center px-4 sm:bottom-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex h-14 max-w-[calc(100vw-2rem)] items-center gap-2 border border-border/80 bg-card/95 px-2 shadow-lg backdrop-blur-md">
        <audio
          ref={audioRef}
          src={track.src}
          preload="metadata"
          muted={isMuted}
          onEnded={() => selectTrack(nextTrackIndex(currentIndex, FARPLANE_RADIO_TRACKS.length))}
          onError={() => {
            wantsPlaybackRef.current = false;
            setIsPlaying(false);
            setErrorText("Track unavailable — skip to retry");
          }}
        />

        <div className="flex w-36 min-w-0 items-center gap-2 border-r border-border/70 pr-2 sm:w-52">
          <div
            aria-hidden="true"
            className={cn(
              "flex h-7 w-6 shrink-0 items-end justify-center gap-0.5 border border-primary/30 bg-primary/10 px-1 py-1",
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
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Farplane Radio
            </p>
            <p aria-live="polite" className="truncate text-xs font-medium text-foreground">
              {errorText || track.title}
            </p>
          </div>
        </div>

        <div className="flex items-center">
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
            size="icon"
            className="size-10"
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
        </div>

        <span className="hidden w-10 text-right text-[10px] tabular-nums text-muted-foreground min-[460px]:inline">
          {String(currentIndex + 1).padStart(2, "0")}/{FARPLANE_RADIO_TRACKS.length}
        </span>

        <div className="hidden items-center gap-2 border-l border-border/70 pl-2 sm:flex">
          <PlayerButton label={isMuted ? "Unmute" : "Mute"} onClick={toggleMute}>
            {isMuted || volume === 0 ? (
              <VolumeX aria-hidden="true" />
            ) : (
              <Volume2 aria-hidden="true" />
            )}
          </PlayerButton>
          <Slider
            aria-label="Farplane Radio volume"
            className="w-20"
            min={0}
            max={1}
            step={0.01}
            value={[isMuted ? 0 : volume]}
            onValueChange={updateVolume}
          />
        </div>
      </div>
    </section>
  );
}
