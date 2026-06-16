import type { SkillInvocationCandidate } from "./handler";

export type SkillInvocationHookPayload = {
  turnId?: string;
  cwd?: string;
  toolName: string;
  skillId: string;
  skillPath: string;
  label: "Read skill MD";
};

export type HookTelemetryEnvelope = {
  hookName: "skill-invocation-listener";
  hookType: "PostToolUse";
  sessionId?: string;
  payload: SkillInvocationHookPayload;
  eventAt: number;
  eventKey: string;
};

export function buildSkillInvocationTelemetryEnvelope(
  candidate: SkillInvocationCandidate,
): HookTelemetryEnvelope {
  return {
    hookName: "skill-invocation-listener",
    hookType: "PostToolUse",
    sessionId: candidate.sessionId,
    payload: {
      turnId: candidate.turnId,
      cwd: candidate.projectPath,
      toolName: candidate.sourceTool,
      skillId: candidate.skillId,
      skillPath: candidate.skillPath,
      label: candidate.label,
    },
    eventAt: candidate.occurredAt,
    eventKey: candidate.stepKey,
  };
}
