/**
 * Named LiveKit worker for Farplane project employees.
 * Inputs: explicit-dispatch metadata plus Doppler-injected LIVEKIT_* credentials.
 * Outputs: one room participant with voice, transcription, addressed group turns, and snapshots.
 * Side effects: subscribes to operator media and runs LiveKit Inference models.
 */

import { fileURLToPath } from "node:url";
import {
  ServerOptions,
  Task,
  cli,
  defineAgent,
  getJobContext,
  inference,
  llm,
  voice,
  type JobContext,
  type JobRequest,
} from "@livekit/agents";
import {
  RoomEvent,
  TrackKind,
  VideoStream,
  type Track,
  type VideoFrame,
} from "@livekit/rtc-node";
import { isAgentAddressed } from "./addressing.js";

const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME?.trim() || "farplane-employee";

type AgentProfile = {
  agentId: string;
  name: string;
  title?: string;
  background?: string;
  voice: { provider: string; model: string; voiceId: string };
  vision?: { mode: "off" | "turn_snapshot" };
};

type DispatchMetadata = {
  projectPath: string;
  agent: AgentProfile;
  groupSize: number;
  isPrimary: boolean;
  aliases: string[];
  openingPrompt?: string;
};

function parseDispatchMetadata(value: string): DispatchMetadata {
  const parsed = JSON.parse(value) as Partial<DispatchMetadata>;
  const agent = parsed.agent;
  if (!agent?.agentId || !agent.name || !agent.voice?.model || !agent.voice.voiceId) {
    throw new Error("farplane_dispatch_metadata_invalid");
  }
  return {
    projectPath: typeof parsed.projectPath === "string" ? parsed.projectPath : "",
    agent,
    groupSize: typeof parsed.groupSize === "number" ? parsed.groupSize : 1,
    isPrimary: parsed.isPrimary === true,
    aliases: Array.isArray(parsed.aliases)
      ? parsed.aliases.map(String).map((entry) => entry.trim()).filter(Boolean)
      : [agent.name],
    openingPrompt:
      typeof parsed.openingPrompt === "string" && parsed.openingPrompt.trim()
        ? parsed.openingPrompt.trim().slice(0, 800)
        : undefined,
  };
}

function profileInstructions(metadata: DispatchMetadata): string {
  const { agent, groupSize } = metadata;
  return [
    `You are ${agent.name}${agent.title ? `, ${agent.title}` : ""}.`,
    agent.background || "You are a concise, capable Farplane project employee.",
    `You are participating in a ${groupSize > 1 ? "group" : "one-to-one"} realtime call.`,
    groupSize > 1
      ? `Only respond when addressed as ${metadata.aliases.join(" or ")}. Stay silent when another person or the group generally is addressed, and do not narrate that you stayed silent.`
      : "Respond naturally and concisely. Prefer spoken answers under thirty seconds unless asked for depth.",
    "You may receive the latest camera or screen-share frame with an operator turn. Describe only what is relevant and do not infer sensitive traits.",
  ].join("\n");
}

function createFarplaneAgent(metadata: DispatchMetadata): voice.Agent {
  let latestFrame: VideoFrame | null = null;
  let videoStream: VideoStream | null = null;
  const videoTasks = new Set<Task<void>>();

  const subscribeToVideo = (track: Track): void => {
    videoStream = new VideoStream(track);
    const readTask = Task.from(async (controller) => {
      if (!videoStream) return;
      for await (const event of videoStream) {
        if (controller.signal.aborted) return;
        latestFrame = event.frame;
      }
    });
    readTask.result.finally(() => videoTasks.delete(readTask));
    videoTasks.add(readTask);
  };

  return voice.Agent.create({
    id: metadata.agent.agentId,
    instructions: profileInstructions(metadata),
    onEnter() {
      const room = getJobContext().room;
      for (const participant of room.remoteParticipants.values()) {
        const track = [...participant.trackPublications.values()]
          .map((publication) => publication.track)
          .find((candidate) => candidate?.kind === TrackKind.KIND_VIDEO);
        if (track) {
          subscribeToVideo(track);
          break;
        }
      }
      room.on(RoomEvent.TrackSubscribed, (track: Track) => {
        if (track.kind === TrackKind.KIND_VIDEO) subscribeToVideo(track);
      });
    },
    onUserTurnCompleted(_context, _chatContext, message) {
      const transcript = message.textContent ?? "";
      if (!isAgentAddressed(transcript, metadata)) throw new voice.StopResponse();
      if (metadata.agent.vision?.mode === "turn_snapshot" && latestFrame) {
        message.content.push(llm.createImageContent({ image: latestFrame }));
        latestFrame = null;
      }
    },
  });
}

const agent = defineAgent({
  entry: async (context: JobContext) => {
    const metadata = parseDispatchMetadata(context.job.metadata);
    await context.connect();
    const session = new voice.AgentSession({
      stt: new inference.STT({
        model: (process.env.FARPLANE_REALTIME_STT?.trim() || "deepgram/nova-3") as never,
        language: "en",
      }),
      llm: new inference.LLM({
        model: (process.env.FARPLANE_REALTIME_LLM?.trim() || "openai/gpt-4.1-mini") as never,
      }),
      tts: new inference.TTS({
        model: (metadata.agent.voice.model.includes("/")
          ? metadata.agent.voice.model
          : `${metadata.agent.voice.provider}/${metadata.agent.voice.model}`) as never,
        voice: metadata.agent.voice.voiceId,
      }),
    });
    await session.start({
      room: context.room,
      agent: createFarplaneAgent(metadata),
      inputOptions: {
        audioEnabled: true,
        textEnabled: true,
        videoEnabled: metadata.agent.vision?.mode === "turn_snapshot",
      },
      outputOptions: { transcriptionEnabled: true },
      record: false,
    });
    if (metadata.isPrimary && metadata.groupSize === 1) {
      await session.generateReply({
        instructions:
          metadata.openingPrompt ??
          "Greet the operator briefly using your configured identity and ask what they want to work through.",
      });
    }
  },
});

const requestFunc = async (request: JobRequest): Promise<void> => {
  try {
    const metadata = parseDispatchMetadata(request.job.metadata);
    await request.accept(
      metadata.agent.name,
      `farplane-agent-${metadata.agent.agentId}-${request.id}`,
      request.job.metadata,
      {
        "farplane.agentId": metadata.agent.agentId,
        "farplane.localOverride": "true",
      },
    );
  } catch {
    await request.reject();
  }
};

export default agent;

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: AGENT_NAME,
    requestFunc,
  }),
);
