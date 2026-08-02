/**
 * Removes credential-shaped fields from parsed Farplane operator settings.
 * Mutates the supplied object so callers can sanitize tolerant legacy TOML parses before writing.
 */

export type RuntimeConfigObject = Record<string, unknown>;

export function stripSecretConfigValues(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const [key, child] of Object.entries(value as RuntimeConfigObject)) {
    if (
      /^(?:token|secret|password|credential)$/i.test(key) ||
      /[_-]token$/i.test(key) ||
      /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|bearer[_-]?token|bot[_-]?token|telemetry[_-]?token|client[_-]?secret|private[_-]?key|oauth|password|credential)/i.test(
        key,
      )
    ) {
      delete (value as RuntimeConfigObject)[key];
      continue;
    }
    stripSecretConfigValues(child);
  }
}
