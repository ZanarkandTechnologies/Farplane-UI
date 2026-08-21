type CapabilityProject = {
  projectId: string;
  projectPath: string;
};

type CapabilityThread = {
  _id: string;
  conversationKey?: { projectId: string };
};

/** Resolve project scope from the durable room-host conversation before agent metadata. */
export function resolveChatCapabilityProjectPath(input: {
  threadId: string | null;
  threads: readonly CapabilityThread[];
  selectedAgentProjectId?: string;
  projects: readonly CapabilityProject[];
}): string {
  const activeThread = input.threads.find((thread) => thread._id === input.threadId);
  const projectId =
    activeThread?.conversationKey?.projectId ?? input.selectedAgentProjectId?.trim() ?? "";
  if (!projectId) return "";
  return input.projects.find((project) => project.projectId === projectId)?.projectPath ?? "";
}
