/**
 * RUNTIME HEALTH MODEL HELPERS
 * ============================
 * Ownership: office HUD Runtime Health panel.
 * Inputs/outputs: runtime adapter kind, endpoint URLs, diagnostic text, and log lines.
 * Side effects: none.
 * Invariants: user-visible diagnostics must not expose local usernames or secret-like values.
 */

type RuntimeKind = "codex" | "openclaw";

const USER_PATH_PATTERNS = [
  /\/Users\/([^/\s]+)\//g,
  /\/home\/([^/\s]+)\//g,
  /[A-Za-z]:\\Users\\([^\\\s]+)\\/g,
];

const SECRET_ASSIGNMENT_PATTERN =
  /\b(api[_-]?key|authorization|password|secret|token)\s*[:=]\s*([^\s,;]+)/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;

export function runtimeEndpointLabel(kind: RuntimeKind): string {
  return kind === "codex" ? "Codex App Server" : "Gateway";
}

export function runtimeEndpointUrl(
  kind: RuntimeKind,
  gatewayBase: string,
  stateBase: string,
): string {
  return kind === "codex" ? stateBase : gatewayBase;
}

export function connectionRecoveryCopy(
  status: "ok" | "unauthorized" | "unreachable" | "error",
  fallback: string,
  kind: RuntimeKind,
): string {
  if (status === "unauthorized") {
    return kind === "codex"
      ? "Codex app-server bridge rejected the request. Check the local app-server bridge session."
      : "Gateway rejected auth. Verify VITE_GATEWAY_TOKEN matches the configured runtime token.";
  }
  if (status === "unreachable") {
    return kind === "codex"
      ? "Codex app-server bridge is unreachable. Verify the local UI state bridge is running."
      : "Gateway is unreachable. Verify the selected runtime is running at the configured URL and port.";
  }
  return fallback;
}

export function sanitizeRuntimeText(text: string, maxLength = 180): string {
  let sanitized = text.replace(/\s+/g, " ").trim();
  for (const pattern of USER_PATH_PATTERNS) {
    sanitized = sanitized.replace(pattern, "~/");
  }
  sanitized = sanitized
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=[redacted]");
  return sanitized.slice(0, maxLength);
}

export function filterRuntimeLines(lines: string[], searchTerm: string): string[] {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return lines;
  return lines.filter((line) => line.toLowerCase().includes(query));
}
