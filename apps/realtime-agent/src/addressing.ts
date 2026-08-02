export type AddressableAgentMetadata = {
  groupSize: number;
  aliases: string[];
};

function normalizedWords(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}@_-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function isAgentAddressed(
  transcript: string,
  metadata: AddressableAgentMetadata,
): boolean {
  if (metadata.groupSize <= 1) return true;
  const haystack = new Set(normalizedWords(transcript));
  return metadata.aliases.some((alias) => {
    const words = normalizedWords(alias);
    return words.some((word) => haystack.has(word) || haystack.has(`@${word.replace(/^@/, "")}`));
  });
}
