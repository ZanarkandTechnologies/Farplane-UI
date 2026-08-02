/**
 * Ownership: project-scoped realtime call setup and connected LiveKit experience.
 * Inputs: selected office employees, live company data, local agent profiles, and session credentials.
 * Side effects: creates a call session and publishes real browser media through LiveKit only.
 */
import "@livekit/components-styles";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  useParticipants,
  useTracks,
  useTranscriptions,
} from "@livekit/components-react";
import { type Participant, Track } from "livekit-client";
import { AlertCircle, Camera, LoaderCircle, Mic, MonitorUp, Phone, PhoneOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { UI_Z } from "@/lib/z-index";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useProjectAgentProfiles } from "../hooks/use-project-agent-profiles";
import { participantAgentId } from "../lib/participant-agent-id";
import { resolveCallSelection } from "../lib/resolve-call-selection";
import { useRealtimeCallStore } from "../store";
import type {
  ProjectAgentProfile,
  RealtimeCallSession,
  RealtimeCallSessionResponse,
} from "../types";
import { AgentPortrait, type AudioTrackReference, LiveAgentPortrait } from "./agent-portrait";

type CallPhase = "setup" | "creating" | "connecting" | "connected" | "ended" | "error";

function callErrorMessage(error: string): string {
  if (error === "livekit_not_configured_in_doppler") {
    return "LiveKit is not configured. Start Farplane through Doppler with LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.";
  }
  if (error === "agent_profile_not_found") {
    return "A selected employee no longer has a local call profile. Reload the call setup.";
  }
  if (error === "agent_profile_config_invalid") {
    return "farplane/agents.yaml is invalid. Fix the reported profile fields, then reopen the call.";
  }
  return error;
}

function CallRoom({
  profiles,
  hasTurnSnapshotVision,
  error,
  onEnd,
}: {
  profiles: ProjectAgentProfile[];
  hasTurnSnapshotVision: boolean;
  error: string | null;
  onEnd: () => void;
}): React.JSX.Element {
  const participants = useParticipants();
  const audioTracks = useTracks([Track.Source.Microphone]);
  const transcriptions = useTranscriptions();
  const participantsByIdentity = useMemo(
    () =>
      new Map(
        participants.flatMap((participant: Participant) => {
          const agentId = participantAgentId(participant);
          return agentId ? [[agentId, participant] as const] : [];
        }),
      ),
    [participants],
  );
  const tracksByIdentity = useMemo(
    () =>
      new Map(
        audioTracks.flatMap((track: AudioTrackReference) => {
          const agentId = participantAgentId(track.participant);
          return agentId ? [[agentId, track] as const] : [];
        }),
      ),
    [audioTracks],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RoomAudioRenderer />
      {error ? (
        <div
          role="alert"
          className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {error}
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 overflow-auto p-4">
        {profiles.map((profile) => {
          const participant = participantsByIdentity.get(profile.agentId);
          return participant ? (
            <LiveAgentPortrait
              key={profile.agentId}
              profile={profile}
              participant={participant}
              audioTrack={tracksByIdentity.get(profile.agentId)}
            />
          ) : (
            <AgentPortrait key={profile.agentId} profile={profile} inRoom />
          );
        })}
      </div>
      <div className="border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div
          className="mx-auto mb-3 max-w-3xl rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground"
          aria-live="polite"
        >
          {transcriptions.length > 0
            ? transcriptions
                .slice(-2)
                .map(
                  (item: (typeof transcriptions)[number]) =>
                    `${item.participantInfo.identity}: ${item.text}`,
                )
                .join(" · ")
            : "Live transcript will appear here when speech is detected."}
        </div>
        {hasTurnSnapshotVision ? (
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Camera & screen share send agents a snapshot after each completed turn.
          </p>
        ) : null}
        <div className="flex items-center justify-center gap-2 [&_.lk-button]:inline-flex [&_.lk-button]:size-10 [&_.lk-button]:items-center [&_.lk-button]:justify-center [&_.lk-button]:rounded-full [&_.lk-button]:border [&_.lk-button]:bg-background [&_.lk-button]:text-foreground [&_.lk-button]:shadow-sm [&_.lk-button]:transition-colors hover:[&_.lk-button]:bg-accent [&_.lk-button[data-lk-enabled=true]]:bg-primary [&_.lk-button[data-lk-enabled=true]]:text-primary-foreground">
          <TrackToggle
            source={Track.Source.Microphone}
            aria-label="Toggle microphone"
            showIcon={false}
          >
            <Mic className="size-4" aria-hidden="true" />
          </TrackToggle>
          <TrackToggle source={Track.Source.Camera} aria-label="Toggle camera" showIcon={false}>
            <Camera className="size-4" aria-hidden="true" />
          </TrackToggle>
          <TrackToggle
            source={Track.Source.ScreenShare}
            aria-label="Toggle screen share"
            showIcon={false}
          >
            <MonitorUp className="size-4" aria-hidden="true" />
          </TrackToggle>
          <Button
            size="icon"
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onEnd}
            aria-label="End call"
          >
            <PhoneOff className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

async function createRealtimeCallSession(
  projectPath: string,
  agents: ProjectAgentProfile[],
  scope: "office" | "project",
): Promise<RealtimeCallSession> {
  const response = await fetch("/farplane/realtime-call/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectPath,
      scope,
      agentIds: agents.map((agent) => agent.agentId),
    }),
  });
  const body = (await response.json().catch(() => null)) as RealtimeCallSessionResponse | null;
  if (!response.ok || !body?.ok || !body.serverUrl || !body.token || !body.roomName) {
    throw new Error(
      callErrorMessage(body?.error || `Could not create the call (${response.status}).`),
    );
  }
  return { serverUrl: body.serverUrl, token: body.token, roomName: body.roomName };
}

export function RealtimeCallDialog(): React.JSX.Element {
  const { companyModel } = useOfficeDataContext();
  const { isOpen, selectedEmployeeIds, closeCall } = useRealtimeCallStore();
  const resolution = useMemo(
    () => resolveCallSelection(companyModel, selectedEmployeeIds),
    [companyModel, selectedEmployeeIds],
  );
  const projectPath = resolution.ok ? resolution.value.projectPath : null;
  const profileScope = resolution.ok ? resolution.value.scope : "project";
  const profileQuery = useProjectAgentProfiles(projectPath, isOpen && resolution.ok, profileScope);
  const [phase, setPhase] = useState<CallPhase>("setup");
  const [session, setSession] = useState<RealtimeCallSession | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const selectedProfiles = useMemo(() => {
    if (!resolution.ok || !profileQuery.data) return [];
    return resolution.value.agentIds
      .map((agentId) => profileQuery.data?.profiles[agentId])
      .filter((profile): profile is ProjectAgentProfile => Boolean(profile));
  }, [profileQuery.data, resolution]);
  const missingProfiles =
    resolution.ok && profileQuery.data
      ? resolution.value.agentIds.filter((agentId) => !profileQuery.data?.profiles[agentId])
      : [];
  const hasTurnSnapshotVision = selectedProfiles.some(
    (profile) => profile.vision?.mode === "turn_snapshot",
  );

  useEffect(() => {
    if (isOpen) return;
    setPhase("setup");
    setSession(null);
    setCallError(null);
  }, [isOpen]);

  const startCall = async (): Promise<void> => {
    if (!resolution.ok || selectedProfiles.length === 0 || missingProfiles.length > 0) return;
    setPhase("creating");
    setCallError(null);
    try {
      const nextSession = await createRealtimeCallSession(
        resolution.value.projectPath,
        selectedProfiles,
        resolution.value.scope,
      );
      setSession(nextSession);
      setPhase("connecting");
    } catch (error) {
      setCallError(error instanceof Error ? error.message : "Could not create the call.");
      setPhase("error");
    }
  };

  const visibleError = !resolution.ok
    ? resolution.error
    : profileQuery.error ||
      (!profileQuery.isLoading && profileQuery.data && !profileQuery.data.exists
        ? profileScope === "office"
          ? "No office call profiles exist. Add the executive specialists to farplane/agents.yaml."
          : "No local call profiles exist for this project. Add agent profiles before starting a call."
        : missingProfiles.length > 0
          ? `Missing local call profiles: ${missingProfiles.join(", ")}.`
          : callError);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeCall();
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayStyle={{ zIndex: UI_Z.panelElevated - 1 }}
        style={{ zIndex: UI_Z.panelElevated }}
        className={cn(
          "flex !h-[94vh] !w-[97vw] !max-w-[1600px] flex-col gap-0 overflow-hidden overscroll-contain p-0",
        )}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Phone className="size-4 text-primary" aria-hidden="true" /> Realtime Call
            </DialogTitle>
            <p className="truncate text-xs text-muted-foreground">
              {session?.roomName ||
                (resolution.ok
                  ? resolution.value.scope === "office"
                    ? "Executive Office"
                    : resolution.value.projectPath
                  : "Project-scoped agent conversation")}
            </p>
          </div>
          <Badge variant={phase === "connected" ? "default" : "outline"} aria-live="polite">
            {phase === "creating" || phase === "connecting" ? (
              <LoaderCircle className="mr-1 size-3 motion-safe:animate-spin" aria-hidden="true" />
            ) : null}
            {phase}
          </Badge>
        </header>

        {session ? (
          <LiveKitRoom
            className="flex min-h-0 flex-1 flex-col"
            serverUrl={session.serverUrl}
            token={session.token}
            connect={phase !== "ended"}
            audio
            video={false}
            onConnected={() => setPhase("connected")}
            onDisconnected={() => setPhase("ended")}
            onError={(error: Error) => {
              setCallError(error.message);
              setPhase("error");
            }}
            onMediaDeviceFailure={() => {
              setCallError(
                "Microphone or camera access was denied. Check browser permissions and try again.",
              );
              setPhase("error");
            }}
          >
            {phase === "ended" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <PhoneOff className="size-10 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Call Ended</h3>
                  <p className="text-sm text-muted-foreground">The room has disconnected.</p>
                </div>
                <Button onClick={closeCall}>Close</Button>
              </div>
            ) : (
              <CallRoom
                profiles={selectedProfiles}
                hasTurnSnapshotVision={hasTurnSnapshotVision}
                error={callError}
                onEnd={() => setPhase("ended")}
              />
            )}
          </LiveKitRoom>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overscroll-contain">
            <div className="flex-1 overflow-auto p-4">
              {profileQuery.isLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />{" "}
                  Loading local profiles…
                </div>
              ) : visibleError ? (
                <div
                  role="alert"
                  className="mx-auto mt-16 max-w-lg rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center"
                >
                  <AlertCircle
                    className="mx-auto mb-3 size-7 text-destructive"
                    aria-hidden="true"
                  />
                  <h3 className="font-semibold">Call Setup Needed</h3>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{visibleError}</p>
                </div>
              ) : (
                <div className="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
                  {selectedProfiles.map((profile) => (
                    <AgentPortrait key={profile.agentId} profile={profile} />
                  ))}
                </div>
              )}
            </div>
            <footer className="flex flex-col items-stretch justify-between gap-2 border-t px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
              <p className="hidden text-xs text-muted-foreground sm:block">
                Microphone joins with the call. You choose when to share camera or screen.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeCall}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void startCall()}
                  disabled={
                    Boolean(visibleError) ||
                    profileQuery.isLoading ||
                    phase === "creating" ||
                    selectedProfiles.length === 0
                  }
                >
                  {phase === "creating" ? (
                    <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                  ) : (
                    <Phone className="size-4" aria-hidden="true" />
                  )}{" "}
                  Start Call
                </Button>
              </div>
            </footer>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
