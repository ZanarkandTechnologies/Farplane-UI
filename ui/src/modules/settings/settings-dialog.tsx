import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store";
import { getGatewayUiConfig } from "@/modules/runtime";
import { setOfficeOnboardingCompleted } from "@/modules/office/lib/office-onboarding";
import type { OfficeSettingsModel } from "@/modules/runtime";
import {
  getRuntimeAdapterKind,
  saveRuntimeAdapterKind,
  type RuntimeAdapterKind,
} from "@/modules/runtime";
import { UI_Z } from "@/lib/z-index";
import { useGateway } from "@/providers/gateway-provider";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOfficeRuntimeAdapter } from "@/modules/runtime";
import {
  GeneralSettingsPanel,
  OfficeViewSettingsPanel,
  RuntimeSettingsPanel,
} from "./settings-dialog-panels";
import { useCodexOfficeVisibilitySettings } from "./use-codex-office-visibility-settings";
import {
  readOfficeCharacterRendererSettings,
  saveOfficeCharacterRendererSettings,
} from "@/modules/office/components/employee/renderers/registry";
import type { CharacterRendererId } from "@/modules/office/components/employee/renderers/types";

type SettingsDialogProps = {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function SettingsDialog(props: SettingsDialogProps) {
  const { open, onOpenChange } = props;
  const adapter = useOfficeRuntimeAdapter();
  const { officeObjects, officeSettings, refresh } = useOfficeDataContext();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const dialogOpen = typeof open === "boolean" ? open : uncontrolledOpen;
  const setDialogOpen = onOpenChange ?? setUncontrolledOpen;
  const debugMode = useAppStore((state) => state.debugMode);
  const setDebugMode = useAppStore((state) => state.setDebugMode);
  const officeOverlays = useAppStore((state) => state.officeOverlays);
  const setOfficeOverlay = useAppStore((state) => state.setOfficeOverlay);
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const setBuilderMode = useAppStore((state) => state.setBuilderMode);
  const setIsOfficeOnboardingVisible = useAppStore(
    (state) => state.setIsOfficeOnboardingVisible,
  );
  const setOfficeOnboardingStep = useAppStore(
    (state) => state.setOfficeOnboardingStep,
  );
  const { connected, updateConfig } = useGateway();
  const gatewayConfig = useMemo(() => getGatewayUiConfig(), []);
  const [gatewayBaseInput, setGatewayBaseInput] = useState(
    gatewayConfig.gatewayBase,
  );
  const [gatewayTokenInput, setGatewayTokenInput] = useState(
    gatewayConfig.gatewayToken,
  );
  const [stateBaseInput, setStateBaseInput] = useState(gatewayConfig.stateBase);
  const [defaultSessionKeyInput, setDefaultSessionKeyInput] = useState(
    gatewayConfig.defaultSessionKey,
  );
  const [languageInput, setLanguageInput] = useState(gatewayConfig.language);
  const [statusText, setStatusText] = useState("");
  const [runtimeKindInput, setRuntimeKindInput] = useState<RuntimeAdapterKind>(
    () => getRuntimeAdapterKind(import.meta.env.VITE_FARPLANE_RUNTIME_ADAPTER),
  );
  const [runtimeStatusText, setRuntimeStatusText] = useState("");
  const [viewProfileInput, setViewProfileInput] = useState<
    OfficeSettingsModel["viewProfile"]
  >(officeSettings.viewProfile);
  const [layoutStrategyInput, setLayoutStrategyInput] = useState<
    NonNullable<OfficeSettingsModel["layoutStrategy"]>
  >(officeSettings.layoutStrategy ?? "activity_treemap");
  const [cameraOrientationInput, setCameraOrientationInput] = useState<
    OfficeSettingsModel["cameraOrientation"]
  >(officeSettings.cameraOrientation);
  const [orbitControlsEnabled, setOrbitControlsEnabled] = useState(
    officeSettings.orbitControlsEnabled,
  );
  const [viewStatusText, setViewStatusText] = useState("");
  const [isSavingViewSettings, setIsSavingViewSettings] = useState(false);
  const [shuffleStatusText, setShuffleStatusText] = useState("");
  const [isShufflingOffice, setIsShufflingOffice] = useState(false);
  const [characterRendererIdInput, setCharacterRendererIdInput] =
    useState<CharacterRendererId>("three-human");
  const [characterSpritePetIdInput, setCharacterSpritePetIdInput] =
    useState("");
  const [characterSpriteEmployeeIdInput, setCharacterSpriteEmployeeIdInput] =
    useState("");
  const [characterGraphicsStatusText, setCharacterGraphicsStatusText] =
    useState("");
  const codexOfficeVisibility = useCodexOfficeVisibilitySettings({
    dialogOpen,
    stateBaseInput,
    refreshOfficeData: refresh,
  });

  useEffect(() => {
    if (!dialogOpen) return;
    const next = getGatewayUiConfig();
    setGatewayBaseInput(next.gatewayBase);
    setGatewayTokenInput(next.gatewayToken);
    setStateBaseInput(next.stateBase);
    setDefaultSessionKeyInput(next.defaultSessionKey);
    setLanguageInput(next.language);
    setStatusText("");
    setRuntimeKindInput(
      getRuntimeAdapterKind(import.meta.env.VITE_FARPLANE_RUNTIME_ADAPTER),
    );
    setRuntimeStatusText("");
    setViewProfileInput(officeSettings.viewProfile);
    setLayoutStrategyInput(officeSettings.layoutStrategy ?? "activity_treemap");
    setCameraOrientationInput(officeSettings.cameraOrientation);
    setOrbitControlsEnabled(officeSettings.orbitControlsEnabled);
    setViewStatusText("");
    setShuffleStatusText("");
    const characterSettings = readOfficeCharacterRendererSettings();
    setCharacterRendererIdInput(
      characterSettings.petId ? "sprite-sheet-2d" : "three-human",
    );
    setCharacterSpritePetIdInput(characterSettings.petId);
    setCharacterSpriteEmployeeIdInput(characterSettings.employeeId);
    setCharacterGraphicsStatusText("");
  }, [
    dialogOpen,
    officeSettings.cameraOrientation,
    officeSettings.layoutStrategy,
    officeSettings.orbitControlsEnabled,
    officeSettings.viewProfile,
  ]);

  function handleRefreshGatewayConfig(): void {
    const next = getGatewayUiConfig();
    setGatewayBaseInput(next.gatewayBase);
    setGatewayTokenInput(next.gatewayToken);
    setStateBaseInput(next.stateBase);
    setDefaultSessionKeyInput(next.defaultSessionKey);
    setLanguageInput(next.language);
    setStatusText("Gateway config reloaded from local settings.");
  }

  function handleConnectGateway(): void {
    const saved = updateConfig({
      gatewayBase: gatewayBaseInput,
      gatewayToken: gatewayTokenInput,
      stateBase: stateBaseInput,
      defaultSessionKey: defaultSessionKeyInput,
      language: languageInput,
    });
    setGatewayBaseInput(saved.gatewayBase);
    setGatewayTokenInput(saved.gatewayToken);
    setStateBaseInput(saved.stateBase);
    setDefaultSessionKeyInput(saved.defaultSessionKey);
    setLanguageInput(saved.language);
    setStatusText("Gateway config saved. Reconnecting gateway client...");
  }

  function handleApplyRuntimeMode(): void {
    const saved = saveRuntimeAdapterKind(runtimeKindInput);
    setRuntimeStatusText(`Runtime mode saved as ${saved}. Reloading...`);
    window.setTimeout(() => window.location.reload(), 250);
  }

  async function handleSaveViewSettings(): Promise<void> {
    setIsSavingViewSettings(true);
    setViewStatusText("");
    const result = await adapter.saveOfficeSettings({
      ...officeSettings,
      layoutStrategy: layoutStrategyInput,
      viewProfile: viewProfileInput,
      cameraOrientation: cameraOrientationInput,
      orbitControlsEnabled,
    });
    setIsSavingViewSettings(false);
    if (!result.ok) {
      setViewStatusText(result.error ?? "Failed to save office view settings.");
      return;
    }
    await refresh();
    setViewStatusText("Office view settings saved.");
  }

  async function handleShuffleOffice(): Promise<void> {
    setIsShufflingOffice(true);
    setShuffleStatusText("");
    const result = await adapter.shuffleOfficeObjects(officeObjects, {
      seed: Date.now(),
    });
    setIsShufflingOffice(false);
    if (!result.ok) {
      setShuffleStatusText(
        result.error ?? "Failed to shuffle office furniture.",
      );
      return;
    }
    await refresh();
    setShuffleStatusText(
      `Shuffled ${result.movedCount} object${result.movedCount === 1 ? "" : "s"} with ${result.placementViolationCount} collisions.`,
    );
  }

  function handleApplyCharacterGraphics(): void {
    if (characterRendererIdInput === "sprite-sheet-2d") {
      const saved = saveOfficeCharacterRendererSettings({
        petId: characterSpritePetIdInput || "mini-kenji",
        employeeId: characterSpriteEmployeeIdInput,
      });
      setCharacterSpritePetIdInput(saved.petId);
      setCharacterSpriteEmployeeIdInput(saved.employeeId);
      setCharacterGraphicsStatusText(
        saved.employeeId
          ? `Sprite renderer applied to ${saved.employeeId}.`
          : "Sprite renderer applied to all employees.",
      );
      return;
    }
    saveOfficeCharacterRendererSettings({ petId: "", employeeId: "" });
    setCharacterSpritePetIdInput("");
    setCharacterSpriteEmployeeIdInput("");
    setCharacterGraphicsStatusText("Three.js humans restored.");
  }

  function handleReplayOnboarding(): void {
    setOfficeOnboardingCompleted(false);
    setIsOfficeOnboardingVisible(true);
    setOfficeOnboardingStep("click-ceo");
    setDialogOpen(false);
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent
        className="max-w-md max-h-[85vh] overflow-y-auto"
        style={{ zIndex: UI_Z.panelBase }}
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" className="py-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="office">Office</TabsTrigger>
            <TabsTrigger value="runtime">Runtime</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4 space-y-4">
            <GeneralSettingsPanel
              debugMode={debugMode}
              officeOverlays={officeOverlays}
              isBuilderMode={isBuilderMode}
              onDebugModeChange={setDebugMode}
              onOfficeOverlayChange={setOfficeOverlay}
              onBuilderModeChange={setBuilderMode}
              onReplayOnboarding={handleReplayOnboarding}
            />
          </TabsContent>

          <TabsContent value="office" className="mt-4 space-y-3">
            <OfficeViewSettingsPanel
              viewProfile={viewProfileInput}
              layoutStrategy={layoutStrategyInput}
              cameraOrientation={cameraOrientationInput}
              orbitControlsEnabled={orbitControlsEnabled}
              statusText={viewStatusText}
              shuffleStatusText={shuffleStatusText}
              isSaving={isSavingViewSettings}
              isShuffling={isShufflingOffice}
              characterRendererId={characterRendererIdInput}
              characterSpritePetId={characterSpritePetIdInput}
              characterSpriteEmployeeId={characterSpriteEmployeeIdInput}
              characterGraphicsStatusText={characterGraphicsStatusText}
              onViewProfileChange={setViewProfileInput}
              onLayoutStrategyChange={setLayoutStrategyInput}
              onCameraOrientationChange={setCameraOrientationInput}
              onOrbitControlsEnabledChange={setOrbitControlsEnabled}
              onSave={() => void handleSaveViewSettings()}
              onShuffle={() => void handleShuffleOffice()}
              onCharacterRendererIdChange={setCharacterRendererIdInput}
              onCharacterSpritePetIdChange={setCharacterSpritePetIdInput}
              onCharacterSpriteEmployeeIdChange={
                setCharacterSpriteEmployeeIdInput
              }
              onApplyCharacterGraphics={handleApplyCharacterGraphics}
            />
          </TabsContent>

          <TabsContent value="runtime" className="mt-4 space-y-4">
            <RuntimeSettingsPanel
              runtimeKind={runtimeKindInput}
              runtimeStatusText={runtimeStatusText}
              connected={connected}
              gatewayBase={gatewayBaseInput}
              gatewayToken={gatewayTokenInput}
              stateBase={stateBaseInput}
              defaultSessionKey={defaultSessionKeyInput}
              language={languageInput}
              codexForm={codexOfficeVisibility.form}
              codexStatusText={codexOfficeVisibility.statusText}
              isSavingCodexSettings={codexOfficeVisibility.isSaving}
              onRuntimeKindChange={setRuntimeKindInput}
              onApplyRuntimeMode={handleApplyRuntimeMode}
              onGatewayBaseChange={setGatewayBaseInput}
              onGatewayTokenChange={setGatewayTokenInput}
              onStateBaseChange={setStateBaseInput}
              onDefaultSessionKeyChange={setDefaultSessionKeyInput}
              onLanguageChange={setLanguageInput}
              onConnectGateway={handleConnectGateway}
              onRefreshGatewayConfig={handleRefreshGatewayConfig}
              onCodexFormChange={codexOfficeVisibility.setForm}
              onSaveCodexSettings={() => void codexOfficeVisibility.save()}
            />
            {runtimeKindInput === "openclaw" && statusText ? (
              <p className="text-xs text-muted-foreground">{statusText}</p>
            ) : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
