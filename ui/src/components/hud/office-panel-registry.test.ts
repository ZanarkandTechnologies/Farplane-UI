import { describe, expect, it, vi } from "vitest";

import {
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

  it("routes review and workspace actions through the provided handlers", () => {
    const openCeoWorkbench = vi.fn();
    const openEvals = vi.fn();
    const openHarness = vi.fn();
    const openGlobalTeamWorkspace = vi.fn();
    const openResourceBank = vi.fn();
    const openSkillInvocations = vi.fn();
    const openSkillOs = vi.fn();
    const openUserCommunications = vi.fn();
    const toggleBuilderMode = vi.fn();

    const actions = createOfficePanelActions({
      highlightedMenuActionId: null,
      isAnimatingCamera: false,
      isBuilderMode: false,
      navigateToLanding: vi.fn(),
      openCeoWorkbench,
      openDecoration: vi.fn(),
      openEvals,
      openHarness,
      openGlobalTeamWorkspace,
      openOrganization: vi.fn(),
      openResourceBank,
      openSettings: vi.fn(),
      openSkillInvocations,
      openSkillOs,
      openTelemetry: vi.fn(),
      openUserCommunications,
      toggleBuilderMode,
    });

    actions.find((action) => action.id === "team-workspace")?.perform();
    actions.find((action) => action.id === "resource-bank")?.perform();
    actions.find((action) => action.id === "skill-os")?.perform();
    actions.find((action) => action.id === "evals")?.perform();
    actions.find((action) => action.id === "harness")?.perform();
    actions.find((action) => action.id === "user-communications")?.perform();
    actions.find((action) => action.id === "human-review")?.perform();
    actions.find((action) => action.id === "builder-mode")?.perform();

    expect(openGlobalTeamWorkspace).toHaveBeenCalledTimes(1);
    expect(openResourceBank).toHaveBeenCalledTimes(1);
    expect(actions.some((action) => String(action.id) === "skill-invocations")).toBe(false);
    expect(openSkillInvocations).not.toHaveBeenCalled();
    expect(openSkillOs).toHaveBeenCalledTimes(1);
    expect(openEvals).toHaveBeenCalledTimes(1);
    expect(openHarness).toHaveBeenCalledTimes(1);
    expect(openUserCommunications).toHaveBeenCalledTimes(1);
    expect(openCeoWorkbench).toHaveBeenCalledWith("review");
    expect(toggleBuilderMode).toHaveBeenCalledTimes(1);
  });

  it("suppresses mutating office actions in read-only mode", () => {
    const openGlobalTeamWorkspace = vi.fn();
    const openSettings = vi.fn();
    const openDecoration = vi.fn();
    const toggleBuilderMode = vi.fn();

    const actions = createOfficePanelActions({
      accessPolicy: "read-only",
      highlightedMenuActionId: null,
      isAnimatingCamera: false,
      isBuilderMode: false,
      navigateToLanding: vi.fn(),
      openCeoWorkbench: vi.fn(),
      openDecoration,
      openEvals: vi.fn(),
      openHarness: vi.fn(),
      openGlobalTeamWorkspace,
      openOrganization: vi.fn(),
      openResourceBank: vi.fn(),
      openSettings,
      openSkillInvocations: vi.fn(),
      openSkillOs: vi.fn(),
      openTelemetry: vi.fn(),
      openUserCommunications: vi.fn(),
      toggleBuilderMode,
    });

    for (const id of [
      "team-workspace",
      "user-communications",
      "human-review",
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
    expect(openDecoration).not.toHaveBeenCalled();
    expect(toggleBuilderMode).not.toHaveBeenCalled();
  });
});
