import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "../../../convex/_generated/api.js";
import { withSourceContract } from "./convex-contract.js";

const queueVideo = api.modules.videoIntelligence.videos.queueVideo;

test("a contract-checked client rejects a field Convex does not declare", async () => {
  const client = withSourceContract({ mutation: async (_reference: unknown, _args: unknown) => "sent" });

  await assert.rejects(
    client.mutation(queueVideo, {
      videoId: "f-Ar8mwm3kQ",
      title: "Claim?",
      instruction: "Extract this into a skill",
    }),
    /queueVideo would be rejected by Convex: args has extra field `instruction`/,
  );
  await assert.rejects(client.mutation(queueVideo, { videoId: "f-Ar8mwm3kQ" }), /missing `title`/);
});

test("a contract-checked client passes valid calls through, treating undefined as absent", async () => {
  const client = withSourceContract({ mutation: async (_reference: unknown, _args: unknown) => "sent" });

  assert.equal(
    await client.mutation(queueVideo, { videoId: "f-Ar8mwm3kQ", title: "Claim?", projectId: undefined }),
    "sent",
  );
});
