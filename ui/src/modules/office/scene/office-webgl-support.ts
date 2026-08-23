export function canCreateWebGlContext(documentRef: Document | undefined = globalThis.document) {
  if (!documentRef) return false;
  const canvas = documentRef.createElement("canvas");
  try {
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}
