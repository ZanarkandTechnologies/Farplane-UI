import { describe, expect, it, vi } from "vitest";

import {
  createOfficeLauncherActions,
  createOfficePanelActions,
  eventMatchesShortcut,
  isEditableEventTarget,
  OFFICE_COMMAND_PALETTE_SHORTCUT,
} from "./office-panel-registry";

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
    const openEvals = vi.fn();
    const openHarness = vi.fn();
    const openRollout = vi.fn();
    const openGlobalTeamWorkspace = vi.fn();
    const openOrganization = vi.fn();
    const openDocumentLibrary = vi.fn();
    const openResourceBank = vi.fn();
    const openWorld = vi.fn();
    const openSkillInvocations = vi.fn();
    const openSkillOs = vi.fn();
    const openRawTelemetry = vi.fn();
    const openThreadData = vi.fn();
    const openTemplateTracking = vi.fn();
    const openUserCommunications = vi.fn();
    const toggleBuilderMode = vi.fn();

    const actions = createOfficePanelActions({
      highlightedMenuActionId: null,
      isAnimatingCamera: false,
      isBuilderMode: false,
      openDecoration: vi.fn(),
      openEvals,
      openHarness,
      openRollout,
      openGlobalTeamWorkspace,
      openOrganization,
      openDocumentLibrary,
      openResourceBank,
      openWorld,
      openSettings: vi.fn(),
      openSkillInvocations,
      openSkillOs,
      openTemplateTracking,
      openRawTelemetry,
      openThreadData,
      openTelemetry: vi.fn(),
      openUserCommunications,
      toggleBuilderMode,
    });

    actions.find((action) => action.id === "team-workspace")?.perform();
    actions.find((action) => action.id === "organization")?.perform();
    actions.find((action) => action.id === "document-library")?.perform();
    actions.find((action) => action.id === "resource-bank")?.perform();
    actions.find((action) => action.id === "world")?.perform();
    actions.find((action) => action.id === "skill-os")?.perform();
    actions.find((action) => action.id === "template-tracking")?.perform();
    actions.find((action) => action.id === "evals")?.perform();
    actions.find((action) => action.id === "harness")?.perform();
    actions.find((action) => action.id === "rollout")?.perform();
    actions.find((action) => action.id === "user-communications")?.perform();
    actions.find((action) => action.id === "raw-telemetry")?.perform();
    actions.find((action) => action.id === "thread-data")?.perform();
    actions.find((action) => action.id === "builder-mode")?.perform();

    expect(openGlobalTeamWorkspace).toHaveBeenCalledTimes(1);
    expect(openOrganization).toHaveBeenCalledTimes(1);
    expect(openDocumentLibrary).toHaveBeenCalledTimes(1);
    expect(openResourceBank).toHaveBeenCalledTimes(1);
    expect(openWorld).toHaveBeenCalledTimes(1);
    expect(actions.some((action) => String(action.id) === "skill-invocations")).toBe(false);
    expect(openSkillInvocations).not.toHaveBeenCalled();
    expect(openSkillOs).toHaveBeenCalledTimes(1);
    expect(openTemplateTracking).toHaveBeenCalledTimes(1);
    expect(openEvals).toHaveBeenCalledTimes(1);
    expect(openHarness).toHaveBeenCalledTimes(1);
    expect(openRollout).toHaveBeenCalledTimes(1);
    expect(openUserCommunications).toHaveBeenCalledTimes(1);
    expect(openRawTelemetry).toHaveBeenCalledTimes(1);
    expect(openThreadData).toHaveBeenCalledTimes(1);
    expect(toggleBuilderMode).toHaveBeenCalledTimes(1);
  });

  it("flattens office launcher actions into one ordered speed-dial list", () => {
    const actions = createOfficePanelActions({
      highlightedMenuActionId: null,
      isAnimatingCamera: false,
      isBuilderMode: false,
      openDecoration: vi.fn(),
      openEvals: vi.fn(),
      openHarness: vi.fn(),
      openRollout: vi.fn(),
      openGlobalTeamWorkspace: vi.fn(),
      openOrganization: vi.fn(),
      openDocumentLibrary: vi.fn(),
      openResourceBank: vi.fn(),
      openWorld: vi.fn(),
      openSettings: vi.fn(),
      openSkillInvocations: vi.fn(),
      openSkillOs: vi.fn(),
      openTemplateTracking: vi.fn(),
      openRawTelemetry: vi.fn(),
      openThreadData: vi.fn(),
      openTelemetry: vi.fn(),
      openUserCommunications: vi.fn(),
      toggleBuilderMode: vi.fn(),
    });

    const launcherActions = createOfficeLauncherActions(actions);
    const paletteIds = actions
      .filter((action) => action.showInPalette !== false)
      .map((action) => action.id);

    expect(launcherActions.map((action) => action.id)).toEqual([
      "organization",
      "user-communications",
      "harness",
      "skill-os",
      "evals",
      "resource-bank",
      "world",
      "document-library",
      "telemetry",
      "raw-telemetry",
      "thread-data",
      "builder-mode",
      "office-shop",
      "settings",
    ]);
    expect(paletteIds).toContain("settings");
    expect(paletteIds).toContain("raw-telemetry");
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
    expect(paletteIds).not.toContain("ceo-workbench");
    expect(paletteIds).not.toContain("human-review");
  });

  it("carries guided onboarding emphasis onto the launcher action", () => {
    const actions = createOfficePanelActions({
      highlightedMenuActionId: "office-shop",
      isAnimatingCamera: false,
      isBuilderMode: false,
      openDecoration: vi.fn(),
      openEvals: vi.fn(),
      openHarness: vi.fn(),
      openRollout: vi.fn(),
      openGlobalTeamWorkspace: vi.fn(),
      openOrganization: vi.fn(),
      openDocumentLibrary: vi.fn(),
      openResourceBank: vi.fn(),
      openWorld: vi.fn(),
      openSettings: vi.fn(),
      openSkillInvocations: vi.fn(),
      openSkillOs: vi.fn(),
      openTemplateTracking: vi.fn(),
      openRawTelemetry: vi.fn(),
      openThreadData: vi.fn(),
      openTelemetry: vi.fn(),
      openUserCommunications: vi.fn(),
      toggleBuilderMode: vi.fn(),
    });

    const launcherActions = createOfficeLauncherActions(actions);
    const officeShopAction = launcherActions.find((action) => action.id === "office-shop");

    expect(officeShopAction?.buttonClassName).toContain("ring-2");
  });

  it("suppresses mutating office actions in read-only mode", () => {
    const openGlobalTeamWorkspace = vi.fn();
    const openSettings = vi.fn();
    const openDecoration = vi.fn();
    const toggleBuilderMode = vi.fn();
    const openThreadData = vi.fn();

    const actions = createOfficePanelActions({
      accessPolicy: "read-only",
      highlightedMenuActionId: null,
      isAnimatingCamera: false,
      isBuilderMode: false,
      openDecoration,
      openEvals: vi.fn(),
      openHarness: vi.fn(),
      openRollout: vi.fn(),
      openGlobalTeamWorkspace,
      openOrganization: vi.fn(),
      openDocumentLibrary: vi.fn(),
      openResourceBank: vi.fn(),
      openWorld: vi.fn(),
      openSettings,
      openSkillInvocations: vi.fn(),
      openSkillOs: vi.fn(),
      openTemplateTracking: vi.fn(),
      openRawTelemetry: vi.fn(),
      openThreadData,
      openTelemetry: vi.fn(),
      openUserCommunications: vi.fn(),
      toggleBuilderMode,
    });

    for (const id of [
      "team-workspace",
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

    expect(openGlobalTeamWorkspace).not.toHaveBeenCalled();
    expect(openSettings).not.toHaveBeenCalled();
    expect(openThreadData).not.toHaveBeenCalled();
    expect(openDecoration).not.toHaveBeenCalled();
    expect(toggleBuilderMode).not.toHaveBeenCalled();
  });
});
