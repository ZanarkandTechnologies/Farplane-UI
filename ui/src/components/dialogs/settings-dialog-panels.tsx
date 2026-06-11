import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OfficeSettingsModel } from "@/lib/openclaw-types";
import type { RuntimeAdapterKind } from "@/lib/runtime-adapters";
import type { CodexOfficeVisibilityForm } from "./use-codex-office-visibility-settings";

type GeneralSettingsPanelProps = {
  debugMode: boolean;
  isBuilderMode: boolean;
  onDebugModeChange: (value: boolean) => void;
  onBuilderModeChange: (value: boolean) => void;
  onReplayOnboarding: () => void;
};

export function GeneralSettingsPanel(props: GeneralSettingsPanelProps) {
  const {
    debugMode,
    isBuilderMode,
    onDebugModeChange,
    onBuilderModeChange,
    onReplayOnboarding,
  } = props;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Theme</Label>
        <ThemeToggle />
      </div>

      <ToggleRow
        label="Debug Mode"
        description="Show paths and grid info"
        enabled={debugMode}
        onToggle={() => onDebugModeChange(!debugMode)}
      />

      <ToggleRow
        label="Builder Mode"
        description="Move furniture and arrange office"
        enabled={isBuilderMode}
        onToggle={() => onBuilderModeChange(!isBuilderMode)}
      />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Label>Onboarding Tour</Label>
          <span className="text-xs text-muted-foreground">
            Replay the guided AI Office intro and CEO-first onboarding flow.
          </span>
        </div>
        <Button onClick={onReplayOnboarding} variant="outline" size="sm">
          Replay
        </Button>
      </div>
    </div>
  );
}

type OfficeViewSettingsPanelProps = {
  viewProfile: OfficeSettingsModel["viewProfile"];
  cameraOrientation: OfficeSettingsModel["cameraOrientation"];
  orbitControlsEnabled: boolean;
  statusText: string;
  isSaving: boolean;
  onViewProfileChange: (value: OfficeSettingsModel["viewProfile"]) => void;
  onCameraOrientationChange: (value: OfficeSettingsModel["cameraOrientation"]) => void;
  onOrbitControlsEnabledChange: (value: boolean) => void;
  onSave: () => void;
};

export function OfficeViewSettingsPanel(props: OfficeViewSettingsPanelProps) {
  const {
    viewProfile,
    cameraOrientation,
    orbitControlsEnabled,
    statusText,
    isSaving,
    onViewProfileChange,
    onCameraOrientationChange,
    onOrbitControlsEnabledChange,
    onSave,
  } = props;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <Label>Office View</Label>
        <span className="text-xs text-muted-foreground">
          Switch between free-orbit 3D and a locked 2.5D game view.
        </span>
      </div>

      <SelectField
        label="View Profile"
        value={viewProfile}
        onChange={(value) => onViewProfileChange(value as OfficeSettingsModel["viewProfile"])}
        options={[
          ["free_orbit_3d", "Free Orbit 3D"],
          ["fixed_2_5d", "Isometric 2.5D"],
        ]}
      />

      <SelectField
        label="Camera Orientation"
        value={cameraOrientation}
        onChange={(value) =>
          onCameraOrientationChange(value as OfficeSettingsModel["cameraOrientation"])
        }
        options={[
          ["south_east", "South East"],
          ["south_west", "South West"],
          ["north_east", "North East"],
          ["north_west", "North West"],
        ]}
      />

      <ToggleRow
        label="Orbit Controls"
        description="In fixed 2.5D, this keeps pan and zoom without unlocking rotation."
        enabled={orbitControlsEnabled}
        onToggle={() => onOrbitControlsEnabledChange(!orbitControlsEnabled)}
      />

      <Button size="sm" onClick={onSave} disabled={isSaving}>
        {isSaving ? "Saving..." : "Apply View"}
      </Button>
      {statusText ? <p className="text-xs text-muted-foreground">{statusText}</p> : null}
    </div>
  );
}

type RuntimeSettingsPanelProps = {
  runtimeKind: RuntimeAdapterKind;
  runtimeStatusText: string;
  connected: boolean;
  gatewayBase: string;
  gatewayToken: string;
  stateBase: string;
  defaultSessionKey: string;
  language: string;
  codexForm: CodexOfficeVisibilityForm;
  codexStatusText: string;
  isSavingCodexSettings: boolean;
  onRuntimeKindChange: (value: RuntimeAdapterKind) => void;
  onApplyRuntimeMode: () => void;
  onGatewayBaseChange: (value: string) => void;
  onGatewayTokenChange: (value: string) => void;
  onStateBaseChange: (value: string) => void;
  onDefaultSessionKeyChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onConnectGateway: () => void;
  onRefreshGatewayConfig: () => void;
  onCodexFormChange: (value: CodexOfficeVisibilityForm) => void;
  onSaveCodexSettings: () => void;
};

export function RuntimeSettingsPanel(props: RuntimeSettingsPanelProps) {
  const {
    runtimeKind,
    runtimeStatusText,
    connected,
    gatewayBase,
    gatewayToken,
    stateBase,
    defaultSessionKey,
    language,
    codexForm,
    codexStatusText,
    isSavingCodexSettings,
    onRuntimeKindChange,
    onApplyRuntimeMode,
    onGatewayBaseChange,
    onGatewayTokenChange,
    onStateBaseChange,
    onDefaultSessionKeyChange,
    onLanguageChange,
    onConnectGateway,
    onRefreshGatewayConfig,
    onCodexFormChange,
    onSaveCodexSettings,
  } = props;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <SelectField
          label="Adapter"
          value={runtimeKind}
          onChange={(value) => onRuntimeKindChange(value as RuntimeAdapterKind)}
          options={[
            ["codex", "Codex"],
            ["openclaw", "OpenClaw"],
          ]}
        />

        <Button size="sm" onClick={onApplyRuntimeMode}>
          Apply Runtime
        </Button>
        {runtimeStatusText ? (
          <p className="text-xs text-muted-foreground">{runtimeStatusText}</p>
        ) : null}
      </div>

      {runtimeKind === "codex" ? (
        <CodexRuntimeSettings
          stateBase={stateBase}
          form={codexForm}
          statusText={codexStatusText}
          isSaving={isSavingCodexSettings}
          onStateBaseChange={onStateBaseChange}
          onFormChange={onCodexFormChange}
          onSave={onSaveCodexSettings}
        />
      ) : (
        <OpenClawRuntimeSettings
          connected={connected}
          gatewayBase={gatewayBase}
          gatewayToken={gatewayToken}
          stateBase={stateBase}
          defaultSessionKey={defaultSessionKey}
          language={language}
          onGatewayBaseChange={onGatewayBaseChange}
          onGatewayTokenChange={onGatewayTokenChange}
          onStateBaseChange={onStateBaseChange}
          onDefaultSessionKeyChange={onDefaultSessionKeyChange}
          onLanguageChange={onLanguageChange}
          onConnectGateway={onConnectGateway}
          onRefreshGatewayConfig={onRefreshGatewayConfig}
        />
      )}
    </div>
  );
}

function CodexRuntimeSettings(props: {
  stateBase: string;
  form: CodexOfficeVisibilityForm;
  statusText: string;
  isSaving: boolean;
  onStateBaseChange: (value: string) => void;
  onFormChange: (value: CodexOfficeVisibilityForm) => void;
  onSave: () => void;
}) {
  const { stateBase, form, statusText, isSaving, onStateBaseChange, onFormChange, onSave } = props;
  const patchForm = (patch: Partial<CodexOfficeVisibilityForm>) =>
    onFormChange({ ...form, ...patch });

  return (
    <div className="space-y-3 border-t pt-4">
      <InputField
        label="State Bridge URL"
        value={stateBase}
        onChange={onStateBaseChange}
        placeholder={typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5173"}
      />

      <InputField
        label="Recent Chat Window Minutes"
        type="number"
        min={1}
        value={form.recentMinutes}
        onChange={(value) => patchForm({ recentMinutes: value })}
      />

      <ToggleRow
        label="Heartbeat Threads"
        description="Keep active or listed heartbeat threads visible even when old."
        enabled={form.alwaysShowHeartbeat}
        onToggle={() => patchForm({ alwaysShowHeartbeat: !form.alwaysShowHeartbeat })}
      />

      <ToggleRow
        label="Automation Heartbeats"
        description="Keep Codex automation threads visible as heartbeat employees."
        enabled={form.showAutomationThreads}
        onToggle={() => patchForm({ showAutomationThreads: !form.showAutomationThreads })}
      />

      <TextareaField
        label="Heartbeat Thread IDs"
        value={form.heartbeatThreadIds}
        onChange={(value) => patchForm({ heartbeatThreadIds: value })}
        placeholder="one thread id per line"
      />

      <InputField
        label="Misc Table Name"
        value={form.miscProjectName}
        onChange={(value) => patchForm({ miscProjectName: value })}
        placeholder="Misc"
      />

      <TextareaField
        label="Misc Path Includes"
        value={form.miscPathIncludes}
        onChange={(value) => patchForm({ miscPathIncludes: value })}
        placeholder="Documents/Codex"
      />

      <Button size="sm" onClick={onSave} disabled={isSaving}>
        {isSaving ? "Saving..." : "Apply Codex Visibility"}
      </Button>
      {statusText ? <p className="text-xs text-muted-foreground">{statusText}</p> : null}
    </div>
  );
}

function OpenClawRuntimeSettings(props: {
  connected: boolean;
  gatewayBase: string;
  gatewayToken: string;
  stateBase: string;
  defaultSessionKey: string;
  language: string;
  onGatewayBaseChange: (value: string) => void;
  onGatewayTokenChange: (value: string) => void;
  onStateBaseChange: (value: string) => void;
  onDefaultSessionKeyChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onConnectGateway: () => void;
  onRefreshGatewayConfig: () => void;
}) {
  const {
    connected,
    gatewayBase,
    gatewayToken,
    stateBase,
    defaultSessionKey,
    language,
    onGatewayBaseChange,
    onGatewayTokenChange,
    onStateBaseChange,
    onDefaultSessionKeyChange,
    onLanguageChange,
    onConnectGateway,
    onRefreshGatewayConfig,
  } = props;

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <Label>Gateway Access</Label>
        <span className={`text-xs ${connected ? "text-emerald-500" : "text-amber-500"}`}>
          {connected ? "connected" : "disconnected"}
        </span>
      </div>

      <InputField
        label="Gateway URL"
        value={gatewayBase}
        onChange={onGatewayBaseChange}
        placeholder="http://127.0.0.1:18789"
      />
      <InputField
        label="Gateway Token"
        type="password"
        value={gatewayToken}
        onChange={onGatewayTokenChange}
        placeholder="optional bearer token"
      />
      <InputField
        label="State Bridge URL"
        value={stateBase}
        onChange={onStateBaseChange}
        placeholder={typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5173"}
      />
      <InputField
        label="Default Session Key"
        value={defaultSessionKey}
        onChange={onDefaultSessionKeyChange}
        placeholder="agent:main:..."
      />
      <SelectField
        label="Language"
        value={language}
        onChange={onLanguageChange}
        options={[
          ["English", "English"],
          ["Japanese", "Japanese"],
          ["Chinese", "Chinese"],
        ]}
      />

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onConnectGateway}>
          Connect
        </Button>
        <Button size="sm" variant="outline" onClick={onRefreshGatewayConfig}>
          Refresh
        </Button>
      </div>
    </div>
  );
}

function ToggleRow(props: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const { label, description, enabled, onToggle } = props;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <Button onClick={onToggle} variant={enabled ? "default" : "outline"} size="sm">
        {enabled ? "On" : "Off"}
      </Button>
    </div>
  );
}

function InputField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  placeholder?: string;
}) {
  const { label, value, onChange, type, min, placeholder } = props;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function TextareaField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { label, value, onChange, placeholder } = props;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <textarea
        className="min-h-20 w-full rounded-md border bg-background px-2 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<[value: string, label: string]>;
  onChange: (value: string) => void;
}) {
  const { label, value, options, onChange } = props;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select
        className="w-full rounded-md border bg-background px-2 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
