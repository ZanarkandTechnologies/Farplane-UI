/**
 * Owns the trusted launch transaction for project-scoped Codex threads.
 * Runtime/IO dependencies stay at the Vite bridge edge; policy compilation is
 * fail-closed and snapshot failure never hides an already-created thread.
 */

import { compileCapabilityProfileConfig } from "../src/modules/runtime/lib/codex-app-server/capability-profile-config";
import type {
  CodexCapabilityProfilesResponse,
  CodexJson,
  CodexThreadStartResponse,
} from "../src/modules/runtime/lib/codex-app-server/types";

export type CapabilityRuntimeCatalog = {
  skillIds: string[];
  mcpServerIds: string[];
};

export type CapabilityProfileLaunchResult = {
  result: CodexThreadStartResponse;
  snapshotRecorded: boolean;
};

type CapabilityProfileLaunchDependencies = {
  readPolicy: (projectPath: string) => Promise<CodexCapabilityProfilesResponse>;
  readRuntimeCatalog: (projectPath: string) => Promise<CapabilityRuntimeCatalog>;
  startThread: (input: {
    cwd: string;
    developerInstructions?: string;
    config?: Record<string, CodexJson>;
  }) => Promise<CodexThreadStartResponse>;
  recordSnapshot: (input: {
    projectPath: string;
    threadId: string;
    profileRef: string | null;
    policyDigest: string;
  }) => Promise<void>;
};

export async function launchCapabilityProfileThread(
  input: { projectPath: string; developerInstructions?: string },
  dependencies: CapabilityProfileLaunchDependencies,
): Promise<CapabilityProfileLaunchResult> {
  const policy = await dependencies.readPolicy(input.projectPath);
  let config: Record<string, CodexJson> | undefined;
  if (policy.active_profile) {
    const runtimeCatalog = await dependencies.readRuntimeCatalog(input.projectPath);
    config = compileCapabilityProfileConfig(policy.active_profile.allow, runtimeCatalog);
  }
  const result = await dependencies.startThread({
    cwd: input.projectPath,
    ...(input.developerInstructions ? { developerInstructions: input.developerInstructions } : {}),
    ...(config ? { config } : {}),
  });
  const threadId = result.thread?.id?.trim();
  if (!threadId) return { result, snapshotRecorded: false };
  const snapshotRecorded = await dependencies
    .recordSnapshot({
      projectPath: input.projectPath,
      threadId,
      profileRef: policy.active_profile?.ref ?? null,
      policyDigest: policy.enforcement.policy_digest,
    })
    .then(() => true)
    .catch(() => false);
  return { result, snapshotRecorded };
}
