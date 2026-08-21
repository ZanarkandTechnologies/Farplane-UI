/**
 * Compiles one portable access profile against the runtime inventory seen by
 * Codex immediately before thread/start. Unknown allowed IDs fail closed.
 */

import type { CapabilityProfileAllowlist, CodexJson } from "./types";

export function compileCapabilityProfileConfig(
  allow: CapabilityProfileAllowlist,
  runtime: { skillIds: readonly string[]; mcpServerIds: readonly string[] },
): Record<string, CodexJson> {
  const skillIds = [...new Set(runtime.skillIds)].sort();
  const mcpServerIds = [...new Set(runtime.mcpServerIds)].sort();
  const allowedSkills = new Set(allow.skill_ids);
  const allowedMcpServers = new Set(allow.mcp_server_ids);
  const missingSkills = [...allowedSkills].filter((id) => !skillIds.includes(id)).sort();
  const missingMcpServers = [...allowedMcpServers]
    .filter((id) => !mcpServerIds.includes(id))
    .sort();
  if (missingSkills.length > 0 || missingMcpServers.length > 0) {
    const reasons = [
      ...(missingSkills.length > 0 ? [`skills=${missingSkills.join(",")}`] : []),
      ...(missingMcpServers.length > 0 ? [`mcp_servers=${missingMcpServers.join(",")}`] : []),
    ];
    throw new Error(`capability_profile_runtime_ids_unavailable:${reasons.join(";")}`);
  }
  return {
    "skills.config": skillIds.map((name) => ({ name, enabled: allowedSkills.has(name) })),
    ...Object.fromEntries(
      mcpServerIds.map((name) => [`mcp_servers.${name}.enabled`, allowedMcpServers.has(name)]),
    ),
  };
}
