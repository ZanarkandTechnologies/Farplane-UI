import { describe, expect, it, vi } from "vitest";

import {
  createOfficeLauncherActions,
  createOfficePanelActions,
  eventMatchesShortcut,
  isEditableEventTarget,
  OFFICE_COMMAND_PALETTE_SHORTCUT,
  type OfficePanelAction,
  type OfficePanelRegistryDependencies,
} from "./office-panel-registry";

type PanelHarness = {
  actions: OfficePanelAction[];
  handlers: OfficePanelRegistryDependencies;
};

function createPanelHarness(
  overrides: Partial<OfficePanelRegistryDependencies> = {},
): PanelHarness {
  const handlers: OfficePanelRegistryDependencies = {
    highlightedMenuActionId: null,
    isAnimatingCamera: false,
    isBuilderMode: false,
    openDecoration: vi.fn(),
    openCeoWorkbench: vi.fn(),
    openDocumentLibrary: vi.fn(),
    openSelfImprovementRuns: vi.fn(),
    openEvals: vi.fn(),
    openFinance: vi.fn(),
    openLeverage: vi.fn(),
    openGlobalTeamWorkspace: vi.fn(),
    openHumanReview: vi.fn(),
    openHarness: vi.fn(),
    openOrganization: vi.fn(),
    openRawTelemetry: vi.fn(),
    openResourceBank: vi.fn(),
    openContentIntelligence: vi.fn(),
    openRollout: vi.fn(),
    openSettings: vi.fn(),
    openSkillInvocations: vi.fn(),
    openSkillOs: vi.fn(),
    openTelemetry: vi.fn(),
    openTemplateTracking: vi.fn(),
    openThreadData: vi.fn(),
    openUserCommunications: vi.fn(),
    openWorld: vi.fn(),
    toggleBuilderMode: vi.fn(),
    ...overrides,
  };

  return {
    actions: createOfficePanelActions(handlers),
    handlers,
  };
}

describe("office panel registry", () => {
  it("matches the palette shortcut with ctrl/cmd+k", () => {
    expect(
      eventMatchesShortcut(
        { altKey: false, ctrlKey: true, key: "k", metaKey: false, shiftKey: false },
        OFFICE_COMMAND_PALETTE_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      eventMatchesShortcut(
        { altKey: false, ctrlKey: false, key: "k", metaKey: true, shiftKey: false },
        OFFICE_COMMAND_PALETTE_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      eventMatchesShortcut(
        { altKey: true, ctrlKey: true, key: "k", metaKey: false, shiftKey: false },
        OFFICE_COMMAND_PALETTE_SHORTCUT,
      ),
    ).toBe(false);
  });

  it("treats text inputs and contenteditable nodes as editable targets", () => {
    const input = {
      closest: vi.fn(() => ({ tagName: "INPUT" })),
      isContentEditable: false,
    };
    const editable = {
      closest: vi.fn(() => null),
      isContentEditable: true,
    };
    const plain = {
      closest: vi.fn(() => null),
      isContentEditable: false,
    };

    expect(isEditableEventTarget(input as unknown as EventTarget)).toBe(true);
    expect(isEditableEventTarget(editable as unknown as EventTarget)).toBe(true);
    expect(isEditableEventTarget(plain as unknown as EventTarget)).toBe(false);
  });

  it("routes launcher actions through the provided handlers", () => {
    const { actions, handlers } = createPanelHarness();

    actions.find((action) => action.id === "team-workspace")?.perform();
    actions.find((action) => action.id === "organization")?.perform();
    actions.find((action) => action.id === "document-library")?.perform();
    actions.find((action) => action.id === "resource-bank")?.perform();
    actions.find((action) => action.id === "content-intelligence")?.perform();
    actions.find((action) => action.id === "world")?.perform();
    actions.find((action) => action.id === "skill-os")?.perform();
    actions.find((action) => action.id === "template-tracking")?.perform();
    actions.find((action) => action.id === "evals")?.perform();
    actions.find((action) => action.id === "harness")?.perform();
    actions.find((action) => action.id === "rollout")?.perform();
    actions.find((action) => action.id === "user-communications")?.perform();
    actions.find((action) => action.id === "ceo-workbench")?.perform();
    actions.find((action) => action.id === "human-review")?.perform();
    actions.find((action) => action.id === "raw-telemetry")?.perform();
    actions.find((action) => action.id === "finance")?.perform();
    actions.find((action) => action.id === "leverage")?.perform();
    actions.find((action) => action.id === "thread-data")?.perform();
    actions.find((action) => action.id === "builder-mode")?.perform();

    expect(handlers.openGlobalTeamWorkspace).toHaveBeenCalledTimes(1);
    expect(handlers.openOrganization).toHaveBeenCalledTimes(1);
    expect(handlers.openDocumentLibrary).toHaveBeenCalledTimes(1);
    expect(handlers.openResourceBank).toHaveBeenCalledTimes(1);
    expect(handlers.openContentIntelligence).toHaveBeenCalledTimes(1);
    expect(handlers.openWorld).toHaveBeenCalledTimes(1);
    expect(actions.some((action) => String(action.id) === "skill-invocations")).toBe(false);
    expect(handlers.openSkillInvocations).not.toHaveBeenCalled();
    expect(handlers.openSkillOs).toHaveBeenCalledTimes(1);
    expect(handlers.openTemplateTracking).toHaveBeenCalledTimes(1);
    expect(handlers.openEvals).toHaveBeenCalledTimes(1);
    expect(handlers.openHarness).toHaveBeenCalledTimes(1);
    expect(handlers.openRollout).toHaveBeenCalledTimes(1);
    expect(handlers.openUserCommunications).toHaveBeenCalledTimes(1);
    expect(handlers.openCeoWorkbench).toHaveBeenCalledTimes(1);
    expect(handlers.openHumanReview).toHaveBeenCalledTimes(1);
    expect(handlers.openRawTelemetry).toHaveBeenCalledTimes(1);
    expect(handlers.openFinance).toHaveBeenCalledTimes(1);
    expect(handlers.openLeverage).toHaveBeenCalledTimes(1);
    expect(handlers.openThreadData).toHaveBeenCalledTimes(1);
    expect(handlers.toggleBuilderMode).toHaveBeenCalledTimes(1);
  });

  it("flattens office launcher actions into one ordered speed-dial list", () => {
    const { actions } = createPanelHarness();

    const launcherActions = createOfficeLauncherActions(actions);
    const paletteIds = actions
      .filter((action) => action.showInPalette !== false)
      .map((action) => action.id);

    expect(launcherActions.map((action) => action.id)).toEqual([
      "organization",
      "ceo-workbench",
      "skill-os",
      "resource-bank",
      "content-intelligence",
      "world",
      "document-library",
      "telemetry",
      "finance",
      "leverage",
      "builder-mode",
      "settings",
    ]);
    expect(paletteIds).toContain("settings");
    expect(paletteIds).toContain("raw-telemetry");
    expect(paletteIds).toContain("finance");
    expect(paletteIds).toContain("leverage");
    expect(paletteIds).toContain("thread-data");
    expect(paletteIds).toContain("evals");
    expect(paletteIds).toContain("harness");
    expect(paletteIds).not.toContain("template-tracking");
    expect(paletteIds).not.toContain("rollout");
    expect(paletteIds).not.toContain("harness-graph");
    expect(paletteIds).not.toContain("harness-rollout");
    expect(paletteIds).not.toContain("template-rollout");
    expect(paletteIds).toContain("builder-mode");
    expect(paletteIds).toContain("office-shop");
    expect(paletteIds).not.toContain("team-workspace");
    expect(paletteIds).toContain("ceo-workbench");
    expect(paletteIds).toContain("human-review");
  });

  it("carries guided onboarding emphasis onto the Builder Mode launcher action", () => {
    const { actions } = createPanelHarness({ highlightedMenuActionId: "builder-mode" });

    const launcherActions = createOfficeLauncherActions(actions);
    const builderModeAction = launcherActions.find((action) => action.id === "builder-mode");

    expect(builderModeAction?.buttonClassName).toContain("ring-2");
  });

  it("suppresses mutating office actions in read-only mode", () => {
    const { actions, handlers } = createPanelHarness({ accessPolicy: "read-only" });

    for (const id of [
      "team-workspace",
      "ceo-workbench",
      "human-review",
      "user-communications",
      "thread-data",
      "builder-mode",
      "office-shop",
      "settings",
    ]) {
      const action = actions.find((candidate) => candidate.id === id);
      expect(action?.disabled).toBe(true);
      expect(action?.showInMenu).toBe(false);
      expect(action?.showInPalette).toBe(false);
      action?.perform();
    }

    expect(handlers.openGlobalTeamWorkspace).not.toHaveBeenCalled();
    expect(handlers.openCeoWorkbench).not.toHaveBeenCalled();
    expect(handlers.openHumanReview).not.toHaveBeenCalled();
    expect(handlers.openSettings).not.toHaveBeenCalled();
    expect(handlers.openThreadData).not.toHaveBeenCalled();
    expect(handlers.openDecoration).not.toHaveBeenCalled();
    expect(handlers.toggleBuilderMode).not.toHaveBeenCalled();
  });
});
