import type {
  BrandKit,
  BrandKitElementSnapshot,
  BrandKitPrompt,
  ResourceBankAssetPreview,
} from "./types";

export function activeKits(kits: BrandKit[]): BrandKit[] {
  return kits.filter((kit) => kit.status === "active");
}

export function elementExamples(
  element: BrandKitElementSnapshot,
  previewByElementId: ReadonlyMap<string, ResourceBankAssetPreview>,
): ResourceBankAssetPreview[] {
  const examples = [
    {
      ...element.goldenExample,
      title: element.goldenExample.title ?? element.title,
      assetKind: element.goldenExample.assetKind ?? element.kind,
    },
  ];
  const fallback = element.provenance.resourceElementId
    ? previewByElementId.get(String(element.provenance.resourceElementId))
    : undefined;
  return fallback ? [...examples, fallback] : examples;
}

export function kitExamples(
  kit: BrandKit,
  previewByElementId: ReadonlyMap<string, ResourceBankAssetPreview> = new Map(),
): ResourceBankAssetPreview[] {
  const examples = kit.elements.flatMap((element) => elementExamples(element, previewByElementId));
  return examples.filter(
    (example, index, all) =>
      all.findIndex((candidate) => exampleKey(candidate) === exampleKey(example)) === index,
  );
}

export function exampleKey(example: ResourceBankAssetPreview): string {
  return String(
    example.storageUrl ??
      example.storageId ??
      example.localPath ??
      example.assetId ??
      example.canonicalUrl ??
      example.sourceUrl ??
      example._id ??
      example.title,
  );
}

export function promptFirstLine(prompt: BrandKitPrompt): string {
  return (
    prompt.text
      .split(/\n+/)
      .find((line) => line.trim())
      ?.trim() ?? ""
  );
}

export function promptStatus(prompt: BrandKitPrompt): string {
  return `prompt rev ${prompt.revision}`;
}

export function promptTextForDraft(prompt: BrandKitPrompt): string {
  return prompt.text;
}

export function promptUnsaved(prompt: BrandKitPrompt, draft: string): boolean {
  return promptTextForDraft(prompt).trim() !== draft.trim();
}
