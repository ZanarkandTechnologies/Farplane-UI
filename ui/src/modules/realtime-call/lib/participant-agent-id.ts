/**
 * Resolves the stable Farplane agent identity published by the named LiveKit worker.
 * Per-job LiveKit participant identities are intentionally not used for profile binding.
 */
export function participantAgentId(participant: {
  attributes: Readonly<Record<string, string>>;
}): string | null {
  const agentId = participant.attributes["farplane.agentId"]?.trim();
  return agentId || null;
}
