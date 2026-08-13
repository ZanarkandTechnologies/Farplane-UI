import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type SettingsDialogTab, useAppStore } from "@/store";
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
import { UserCommunicationsTab } from "@/modules/user-communications";
import {
  GeneralSettingsPanel,
  FeatureConfigurationPanel,
  OfficeViewSettingsPanel,
  RuntimeSettingsPanel,
} from "./settings-dialog-panels";
import { ConfigurationOverviewPanel } from "./configuration-overview-panel";
import {
  EMPTY_RUNTIME_CONFIG_FORM,
  loadRuntimeConfigSettings,
  saveRuntimeConfigSettings,
  type RuntimeConfigForm,
} from "./runtime-config-settings";
import { useCodexOfficeVisibilitySettings } from "./use-codex-office-visibility-settings";
import { useConfigurationCatalog } from "./use-configuration-catalog";
import {
  readOfficeCharacterRendererSettings,
  saveOfficeCharacterRendererSettings,
} from "@/modules/office/components/employee/renderers/registry";
import type { CharacterRendererId } from "@/modules/office/components/employee/renderers/types";

type SettingsDialogProps = {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialTab?: SettingsDialogTab;
};

const SETTINGS_DIALOG_CLASSNAME =
  "flex h-[min(88dvh,760px)] w-[calc(100vw-2rem)] max-w-[1120px] flex-col gap-0 overflow-hidden overscroll-contain p-0 sm:max-w-[1120px]";

export default function SettingsDialog(props: SettingsDialogProps) {
  const { open, onOpenChange, initialTab = "general" } = props;
  const adapter = useOfficeRuntimeAdapter();
  const { officeObjects, officeSettings, refresh, applyOfficeSettings } = useOfficeDataContext();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const dialogOpen = typeof open === "boolean" ? open : uncontrolledOpen;
  const setDialogOpen = onOpenChange ?? setUncontrolledOpen;
  const [activeTab, setActiveTab] = useState<SettingsDialogTab>(initialTab);
  const debugMode = useAppStore((state) => state.debugMode);
  const setDebugMode = useAppStore((state) => state.setDebugMode);
  const officeOverlays = useAppStore((state) => state.officeOverlays);
  const setOfficeOverlay = useAppStore((state) => state.setOfficeOverlay);
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const setBuilderMode = useAppStore((state) => state.setBuilderMode);
  const setIsOfficeOnboardingVisible = useAppStore((state) => state.setIsOfficeOnboardingVisible);
  const setOfficeOnboardingStep = useAppStore((state) => state.setOfficeOnboardingStep);
  const { connected, updateConfig } = useGateway();
  const gatewayConfig = useMemo(() => getGatewayUiConfig(), []);
  const [gatewayBaseInput, setGatewayBaseInput] = useState(gatewayConfig.gatewayBase);
  const [stateBaseInput, setStateBaseInput] = useState(gatewayConfig.stateBase);
  const [defaultSessionKeyInput, setDefaultSessionKeyInput] = useState(
    gatewayConfig.defaultSessionKey,
  );
  const [languageInput, setLanguageInput] = useState(gatewayConfig.language);
  const [statusText, setStatusText] = useState("");
  const [runtimeKindInput, setRuntimeKindInput] = useState<RuntimeAdapterKind>(() =>
    getRuntimeAdapterKind(import.meta.env.VITE_FARPLANE_RUNTIME_ADAPTER),
  );
  const [runtimeStatusText, setRuntimeStatusText] = useState("");
  const [runtimeConfigForm, setRuntimeConfigForm] =
    useState<RuntimeConfigForm>(EMPTY_RUNTIME_CONFIG_FORM);
  const [runtimeConfigStatusText, setRuntimeConfigStatusText] = useState("");
  const [isSavingRuntimeConfig, setIsSavingRuntimeConfig] = useState(false);
  const [viewProfileInput, setViewProfileInput] = useState<OfficeSettingsModel["viewProfile"]>(
    officeSettings.viewProfile,
  );
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
  const [characterSpritePetIdInput, setCharacterSpritePetIdInput] = useState("");
  const [characterSpriteEmployeeIdInput, setCharacterSpriteEmployeeIdInput] = useState("");
  const [characterGraphicsStatusText, setCharacterGraphicsStatusText] = useState("");
  const configurationCatalog = useConfigurationCatalog(dialogOpen);
  const codexOfficeVisibility = useCodexOfficeVisibilitySettings({
    dialogOpen,
    stateBaseInput,
    refreshOfficeData: refresh,
  });

  useEffect(() => {
    if (!dialogOpen) return;
    setActiveTab(initialTab);
    const next = getGatewayUiConfig();
    setGatewayBaseInput(next.gatewayBase);
    setStateBaseInput(next.stateBase);
    setDefaultSessionKeyInput(next.defaultSessionKey);
    setLanguageInput(next.language);
    setStatusText("");
    setRuntimeKindInput(getRuntimeAdapterKind(import.meta.env.VITE_FARPLANE_RUNTIME_ADAPTER));
    setRuntimeStatusText("");
    setRuntimeConfigStatusText("");
    setViewProfileInput(officeSettings.viewProfile);
    setCameraOrientationInput(officeSettings.cameraOrientation);
    setOrbitControlsEnabled(officeSettings.orbitControlsEnabled);
    setViewStatusText("");
    setShuffleStatusText("");
    const characterSettings = readOfficeCharacterRendererSettings();
    setCharacterRendererIdInput(characterSettings.petId ? "sprite-sheet-2d" : "three-human");
    setCharacterSpritePetIdInput(characterSettings.petId);
    setCharacterSpriteEmployeeIdInput(characterSettings.employeeId);
    setCharacterGraphicsStatusText("");
  }, [
    dialogOpen,
    initialTab,
    officeSettings.cameraOrientation,
    officeSettings.orbitControlsEnabled,
    officeSettings.viewProfile,
  ]);

  useEffect(() => {
    if (!dialogOpen) return;
    let cancelled = false;
    loadRuntimeConfigSettings()
      .then((result) => {
        if (cancelled) return;
        setRuntimeConfigForm(result.form);
      })
      .catch(() => {
        if (cancelled) return;
        setRuntimeConfigForm(EMPTY_RUNTIME_CONFIG_FORM);
        setRuntimeConfigStatusText("Runtime config is unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen]);

  function handleRefreshGatewayConfig(): void {
    const next = getGatewayUiConfig();
    setGatewayBaseInput(next.gatewayBase);
    setStateBaseInput(next.stateBase);
    setDefaultSessionKeyInput(next.defaultSessionKey);
    setLanguageInput(next.language);
    setStatusText("Gateway config reloaded from local settings.");
  }

  function handleConnectGateway(): void {
    const saved = updateConfig({
      gatewayBase: gatewayBaseInput,
      stateBase: stateBaseInput,
      defaultSessionKey: defaultSessionKeyInput,
      language: languageInput,
    });
    setGatewayBaseInput(saved.gatewayBase);
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

  async function handleSaveRuntimeConfig(): Promise<void> {
    setIsSavingRuntimeConfig(true);
    setRuntimeConfigStatusText("");
    try {
      const result = await saveRuntimeConfigSettings(runtimeConfigForm);
      setRuntimeConfigForm(result.form);
      setRuntimeConfigStatusText("Runtime config saved.");
    } catch {
      setRuntimeConfigStatusText(
        "Could not save configuration. Check the local state bridge and try again.",
      );
    } finally {
      setIsSavingRuntimeConfig(false);
    }
  }

  async function handleSaveViewSettings(): Promise<void> {
    setIsSavingViewSettings(true);
    setViewStatusText("");
    const nextSettings: OfficeSettingsModel = {
      ...officeSettings,
      layoutStrategy: "manual",
      viewProfile: viewProfileInput,
      cameraOrientation: cameraOrientationInput,
      orbitControlsEnabled,
    };
    applyOfficeSettings(nextSettings);
    const result = await adapter.saveOfficeSettings(nextSettings);
    setIsSavingViewSettings(false);
    if (!result.ok) {
      setViewStatusText(
        result.error
          ? `Preview applied locally; save failed: ${result.error}`
          : "Preview applied locally; failed to save office view settings.",
      );
      return;
    }
    applyOfficeSettings(result.settings);
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
      setShuffleStatusText(result.error ?? "Failed to shuffle office furniture.");
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
      <DialogContent className={SETTINGS_DIALOG_CLASSNAME} style={{ zIndex: UI_Z.panelBase }}>
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as SettingsDialogTab)}
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 px-5 py-4 sm:px-6"
        >
          <TabsList className="grid w-full shrink-0 grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="office">Office</TabsTrigger>
            <TabsTrigger value="configurations">Configs</TabsTrigger>
            <TabsTrigger value="communications">Comms</TabsTrigger>
          </TabsList>

          <TabsContent
            value="general"
            className="mt-4 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1"
          >
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

          <TabsContent
            value="office"
            className="mt-4 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1"
          >
            <OfficeViewSettingsPanel
              viewProfile={viewProfileInput}
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
              onCameraOrientationChange={setCameraOrientationInput}
              onOrbitControlsEnabledChange={setOrbitControlsEnabled}
              onSave={() => void handleSaveViewSettings()}
              onShuffle={() => void handleShuffleOffice()}
              onCharacterRendererIdChange={setCharacterRendererIdInput}
              onCharacterSpritePetIdChange={setCharacterSpritePetIdInput}
              onCharacterSpriteEmployeeIdChange={setCharacterSpriteEmployeeIdInput}
              onApplyCharacterGraphics={handleApplyCharacterGraphics}
            />
          </TabsContent>

          <TabsContent
            value="configurations"
            className="mt-4 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1"
          >
            <ConfigurationOverviewPanel
              form={runtimeConfigForm}
              projectFiles={configurationCatalog.files}
              projectState={configurationCatalog.state}
              projectError={configurationCatalog.error}
              videoAnalysis={
                <FeatureConfigurationPanel
                  form={runtimeConfigForm}
                  statusText={runtimeConfigStatusText}
                  isSaving={isSavingRuntimeConfig}
                  onFormChange={setRuntimeConfigForm}
                  onSave={() => void handleSaveRuntimeConfig()}
                />
              }
              telegram={<UserCommunicationsTab settingsOnly />}
              runtimeAutomation={
                <div className="space-y-3">
                  <RuntimeSettingsPanel
                    runtimeKind={runtimeKindInput}
                    runtimeStatusText={runtimeStatusText}
                    connected={connected}
                    gatewayBase={gatewayBaseInput}
                    stateBase={stateBaseInput}
                    defaultSessionKey={defaultSessionKeyInput}
                    language={languageInput}
                    codexForm={codexOfficeVisibility.form}
                    codexStatusText={codexOfficeVisibility.statusText}
                    isSavingCodexSettings={codexOfficeVisibility.isSaving}
                    runtimeConfigForm={runtimeConfigForm}
                    runtimeConfigStatusText={runtimeConfigStatusText}
                    isSavingRuntimeConfig={isSavingRuntimeConfig}
                    onRuntimeKindChange={setRuntimeKindInput}
                    onApplyRuntimeMode={handleApplyRuntimeMode}
                    onGatewayBaseChange={setGatewayBaseInput}
                    onStateBaseChange={setStateBaseInput}
                    onDefaultSessionKeyChange={setDefaultSessionKeyInput}
                    onLanguageChange={setLanguageInput}
                    onConnectGateway={handleConnectGateway}
                    onRefreshGatewayConfig={handleRefreshGatewayConfig}
                    onCodexFormChange={codexOfficeVisibility.setForm}
                    onSaveCodexSettings={() => void codexOfficeVisibility.save()}
                    onRuntimeConfigFormChange={setRuntimeConfigForm}
                    onSaveRuntimeConfig={() => void handleSaveRuntimeConfig()}
                  />
                  {runtimeKindInput === "openclaw" && statusText ? (
                    <p className="text-xs text-muted-foreground">{statusText}</p>
                  ) : null}
                </div>
              }
              officeAndAppearance={
                <div className="grid gap-6 xl:grid-cols-2">
                  <GeneralSettingsPanel
                    debugMode={debugMode}
                    officeOverlays={officeOverlays}
                    isBuilderMode={isBuilderMode}
                    onDebugModeChange={setDebugMode}
                    onOfficeOverlayChange={setOfficeOverlay}
                    onBuilderModeChange={setBuilderMode}
                    onReplayOnboarding={handleReplayOnboarding}
                  />
                  <OfficeViewSettingsPanel
                    viewProfile={viewProfileInput}
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
                    onCameraOrientationChange={setCameraOrientationInput}
                    onOrbitControlsEnabledChange={setOrbitControlsEnabled}
                    onSave={() => void handleSaveViewSettings()}
                    onShuffle={() => void handleShuffleOffice()}
                    onCharacterRendererIdChange={setCharacterRendererIdInput}
                    onCharacterSpritePetIdChange={setCharacterSpritePetIdInput}
                    onCharacterSpriteEmployeeIdChange={setCharacterSpriteEmployeeIdInput}
                    onApplyCharacterGraphics={handleApplyCharacterGraphics}
                  />
                </div>
              }
            />
          </TabsContent>

          <TabsContent
            value="communications"
            className="mt-4 min-h-0 min-w-0 flex-1 overflow-hidden"
          >
            <UserCommunicationsTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
