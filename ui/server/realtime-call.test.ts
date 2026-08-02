import { describe, expect, it, vi } from "vitest";
import {
  createRealtimeCallSession,
  normalizeRealtimeCallSessionInput,
  readLiveKitEnvironment,
} from "./realtime-call";

const validInput = {
  projectPath: "/projects/farplane",
  agents: [
    {
      agentId: "maya",
      name: "Maya",
      voice: { provider: "livekit-inference", model: "cartesia/sonic-3", voiceId: "voice-a" },
      vision: { mode: "turn_snapshot" },
    },
    {
      agentId: "ken",
      name: "Ken",
      voice: { provider: "livekit-inference", model: "cartesia/sonic-3", voiceId: "voice-b" },
    },
  ],
};

const environment = {
  LIVEKIT_URL: "wss://farplane.livekit.cloud",
  LIVEKIT_API_KEY: "key",
  LIVEKIT_API_SECRET: "secret-secret-secret-secret-secret-secret",
};

describe("realtime call bridge", () => {
  it("requires Doppler-provided LiveKit values", () => {
    expect(() => readLiveKitEnvironment({})).toThrow("livekit_not_configured_in_doppler");
    expect(readLiveKitEnvironment(environment).apiHost).toBe("https://farplane.livekit.cloud");
  });

  it("validates a unique bounded employee roster", () => {
    expect(normalizeRealtimeCallSessionInput(validInput).agents).toHaveLength(2);
    expect(() =>
      normalizeRealtimeCallSessionInput({
        ...validInput,
        agents: [validInput.agents[0], validInput.agents[0]],
      }),
    ).toThrow("realtime_call_agent_duplicate");
  });

  it("dispatches every selected employee into one room", async () => {
    const createDispatch = vi
      .fn()
      .mockResolvedValueOnce({ id: "dispatch-a" })
      .mockResolvedValueOnce({ id: "dispatch-b" });
    const session = await createRealtimeCallSession(validInput, {
      environment,
      uuid: () => "fixed",
      dispatchApi: { createDispatch, deleteDispatch: vi.fn() },
    });

    expect(session.roomName).toBe("farplane-fixed");
    expect(session.agentCount).toBe(2);
    expect(createDispatch).toHaveBeenCalledTimes(2);
    expect(createDispatch.mock.calls[0]?.[0]).toBe("farplane-fixed");
    expect(JSON.parse(createDispatch.mock.calls[0]?.[2]?.metadata ?? "{}")).toMatchObject({
      groupSize: 2,
      isPrimary: true,
      aliases: ["Maya"],
      agent: { agentId: "maya" },
    });
  });

  it("rolls back prior dispatches when a later employee fails", async () => {
    const deleteDispatch = vi.fn().mockResolvedValue(undefined);
    const createDispatch = vi
      .fn()
      .mockResolvedValueOnce({ id: "dispatch-a" })
      .mockRejectedValueOnce(new Error("worker_unavailable"));
    await expect(
      createRealtimeCallSession(validInput, {
        environment,
        uuid: () => "fixed",
        dispatchApi: { createDispatch, deleteDispatch },
      }),
    ).rejects.toThrow("worker_unavailable");
    expect(deleteDispatch).toHaveBeenCalledWith("dispatch-a", "farplane-fixed");
  });
});
