import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CharacterRendererId } from "@/modules/office/components/employee/renderers/types";
import type { OfficeSettingsModel, RuntimeAdapterKind } from "@/modules/runtime";
import type { OfficeOverlayKey, OfficeOverlaySettings } from "@/store";
import {
  credentialSetupCommands,
  type RuntimeConfigForm,
  type RuntimeEnvEntry,
  type RuntimeSecretStatus,
} from "./runtime-config-settings";
import type { CodexOfficeVisibilityForm } from "./use-codex-office-visibility-settings";

const DEBUG_OVERLAY_OPTIONS: Array<{
  key: OfficeOverlayKey;
  label: string;
  description: string;
}> = [
  {
    key: "grid",
    label: "Walkability grid",
    description: "Navigation cells and blocked/open pathing tiles.",
  },
  {
    key: "occupancy",
    label: "Object occupancy",
    description: "Furniture, team-cluster, and out-of-floor footprint cells.",
  },
  {
    key: "paths",
    label: "Agent paths",
    description: "Live route lines and movement decisions for employees.",
  },
  {
    key: "destinations",
    label: "Reserved destinations",
    description: "Active navigation target reservations.",
  },
  {
    key: "areas",
    label: "Team areas",
    description: "Hierarchy-derived office districts.",
  },
  {
    key: "layout",
    label: "Layout labels",
    description: "Tile coordinates and protected anchor labels while editing.",
  },
];

type GeneralSettingsPanelProps = {
  debugMode: boolean;
  officeOverlays: OfficeOverlaySettings;
  isBuilderMode: boolean;
  onDebugModeChange: (value: boolean) => void;
  onOfficeOverlayChange: (key: OfficeOverlayKey, value: boolean) => void;
  onBuilderModeChange: (value: boolean) => void;
  onReplayOnboarding: () => void;
};

export function GeneralSettingsPanel(props: GeneralSettingsPanelProps) {
  const {
    debugMode,
    officeOverlays,
    isBuilderMode,
    onDebugModeChange,
    onOfficeOverlayChange,
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
        description="Enable diagnostic office overlays"
        enabled={debugMode}
        onToggle={() => onDebugModeChange(!debugMode)}
      />

      <div className="space-y-2 rounded-md border border-border/70 p-3">
        <div className="flex flex-col gap-1">
          <Label>Debug Overlays</Label>
          <span className="text-xs text-muted-foreground">
            Debug Mode is a master switch. These categories opt in one at a time.
          </span>
        </div>
        <div className="space-y-1.5">
          {DEBUG_OVERLAY_OPTIONS.map((option) => (
            <OverlayToggle
              key={option.key}
              label={option.label}
              description={option.description}
              enabled={officeOverlays[option.key]}
              disabled={!debugMode}
              onToggle={(value) => onOfficeOverlayChange(option.key, value)}
            />
          ))}
        </div>
      </div>

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

function OverlayToggle(props: {
  label: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  const { label, description, enabled, disabled, onToggle } = props;
  return (
    <label
      className={`grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md px-2 py-2 text-sm transition-colors ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted"
      }`}
    >
      <Checkbox
        checked={enabled}
        disabled={disabled}
        onCheckedChange={(value) => onToggle(value === true)}
        className="mt-0.5"
      />
      <span className="grid min-w-0 gap-0.5">
        <span className="font-medium leading-none">{label}</span>
        <span className="text-xs leading-snug text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

type OfficeViewSettingsPanelProps = {
  viewProfile: OfficeSettingsModel["viewProfile"];
  cameraOrientation: OfficeSettingsModel["cameraOrientation"];
  orbitControlsEnabled: boolean;
  statusText: string;
  shuffleStatusText: string;
  isSaving: boolean;
  isShuffling: boolean;
  characterRendererId: CharacterRendererId;
  characterSpritePetId: string;
  characterSpriteEmployeeId: string;
  characterGraphicsStatusText: string;
  onViewProfileChange: (value: OfficeSettingsModel["viewProfile"]) => void;
  onCameraOrientationChange: (value: OfficeSettingsModel["cameraOrientation"]) => void;
  onOrbitControlsEnabledChange: (value: boolean) => void;
  onSave: () => void;
  onShuffle: () => void;
  onCharacterRendererIdChange: (value: CharacterRendererId) => void;
  onCharacterSpritePetIdChange: (value: string) => void;
  onCharacterSpriteEmployeeIdChange: (value: string) => void;
  onApplyCharacterGraphics: () => void;
};

export function OfficeViewSettingsPanel(props: OfficeViewSettingsPanelProps) {
  const {
    viewProfile,
    cameraOrientation,
    orbitControlsEnabled,
    statusText,
    shuffleStatusText,
    isSaving,
    isShuffling,
    characterRendererId,
    characterSpritePetId,
    characterSpriteEmployeeId,
    characterGraphicsStatusText,
    onViewProfileChange,
    onCameraOrientationChange,
    onOrbitControlsEnabledChange,
    onSave,
    onShuffle,
    onCharacterRendererIdChange,
    onCharacterSpritePetIdChange,
    onCharacterSpriteEmployeeIdChange,
    onApplyCharacterGraphics,
  } = props;
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <Label>Office View</Label>
        <span className="text-xs text-muted-foreground">
          Adjust camera and rendering preferences for your saved office.
        </span>
      </div>

      <div className="rounded-md border bg-muted/30 px-3 py-2">
        <p className="text-sm font-medium text-foreground">Saved office</p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          Furniture and floor placement stay fixed until you move them in Builder, shuffle
          explicitly, or equip a different office template.
        </p>
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

      <div className="flex items-center justify-between gap-4 border-t pt-3">
        <div className="flex flex-col gap-1">
          <Label>Furniture Layout</Label>
          <span className="text-xs text-muted-foreground">
            Reflow tables and floor objects into open slots.
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onShuffle} disabled={isShuffling}>
          {isShuffling ? "Shuffling..." : "Shuffle"}
        </Button>
      </div>
      {shuffleStatusText ? (
        <p className="text-xs text-muted-foreground">{shuffleStatusText}</p>
      ) : null}

      <div className="space-y-3 border-t pt-3">
        <div className="flex flex-col gap-1">
          <Label>Employee Graphics</Label>
          <span className="text-xs text-muted-foreground">
            Choose the office-wide character renderer for employees.
          </span>
        </div>

        <SelectField
          label="Renderer"
          value={characterRendererId}
          onChange={(value) => onCharacterRendererIdChange(value as CharacterRendererId)}
          options={[
            ["three-human", "Three.js Humans"],
            ["sprite-sheet-2d", "2D Sprite Sheet"],
          ]}
        />

        {characterRendererId === "sprite-sheet-2d" ? (
          <>
            <InputField
              label="Codex Pet ID"
              value={characterSpritePetId}
              onChange={onCharacterSpritePetIdChange}
              placeholder="mini-kenji"
            />
            <InputField
              label="Employee ID"
              value={characterSpriteEmployeeId}
              onChange={onCharacterSpriteEmployeeIdChange}
              placeholder="blank means all employees"
            />
          </>
        ) : null}

        <Button size="sm" variant="outline" onClick={onApplyCharacterGraphics}>
          Apply Graphics
        </Button>
        {characterGraphicsStatusText ? (
          <p className="text-xs text-muted-foreground">{characterGraphicsStatusText}</p>
        ) : null}
      </div>
    </div>
  );
}

type RuntimeSettingsPanelProps = {
  runtimeKind: RuntimeAdapterKind;
  runtimeStatusText: string;
  connected: boolean;
  gatewayBase: string;
  stateBase: string;
  defaultSessionKey: string;
  language: string;
  codexForm: CodexOfficeVisibilityForm;
  codexStatusText: string;
  isSavingCodexSettings: boolean;
  runtimeConfigForm: RuntimeConfigForm;
  runtimeConfigStatusText: string;
  isSavingRuntimeConfig: boolean;
  onRuntimeKindChange: (value: RuntimeAdapterKind) => void;
  onApplyRuntimeMode: () => void;
  onGatewayBaseChange: (value: string) => void;
  onStateBaseChange: (value: string) => void;
  onDefaultSessionKeyChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onConnectGateway: () => void;
  onRefreshGatewayConfig: () => void;
  onCodexFormChange: (value: CodexOfficeVisibilityForm) => void;
  onSaveCodexSettings: () => void;
  onRuntimeConfigFormChange: (value: RuntimeConfigForm) => void;
  onSaveRuntimeConfig: () => void;
};

export function RuntimeSettingsPanel(props: RuntimeSettingsPanelProps) {
  const {
    runtimeKind,
    runtimeStatusText,
    connected,
    gatewayBase,
    stateBase,
    defaultSessionKey,
    language,
    codexForm,
    codexStatusText,
    isSavingCodexSettings,
    runtimeConfigForm,
    runtimeConfigStatusText,
    isSavingRuntimeConfig,
    onRuntimeKindChange,
    onApplyRuntimeMode,
    onGatewayBaseChange,
    onStateBaseChange,
    onDefaultSessionKeyChange,
    onLanguageChange,
    onConnectGateway,
    onRefreshGatewayConfig,
    onCodexFormChange,
    onSaveCodexSettings,
    onRuntimeConfigFormChange,
    onSaveRuntimeConfig,
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
          stateBase={stateBase}
          defaultSessionKey={defaultSessionKey}
          language={language}
          onGatewayBaseChange={onGatewayBaseChange}
          onStateBaseChange={onStateBaseChange}
          onDefaultSessionKeyChange={onDefaultSessionKeyChange}
          onLanguageChange={onLanguageChange}
          onConnectGateway={onConnectGateway}
          onRefreshGatewayConfig={onRefreshGatewayConfig}
        />
      )}

      <RuntimeProjectConfigSettings
        form={runtimeConfigForm}
        statusText={runtimeConfigStatusText}
        isSaving={isSavingRuntimeConfig}
        onFormChange={onRuntimeConfigFormChange}
        onSave={onSaveRuntimeConfig}
      />
    </div>
  );
}

function RuntimeProjectConfigSettings(props: {
  form: RuntimeConfigForm;
  statusText: string;
  isSaving: boolean;
  onFormChange: (value: RuntimeConfigForm) => void;
  onSave: () => void;
}) {
  const { form, statusText, isSaving, onFormChange, onSave } = props;
  const updateEnvEntry = (name: string, value: string) =>
    onFormChange({
      ...form,
      env: form.env.map((entry) => (entry.name === name ? { ...entry, value } : entry)),
    });
  const envGroups = form.env.reduce<Array<[string, RuntimeEnvEntry[]]>>((groups, entry) => {
    const existing = groups.find(([group]) => group === entry.group);
    if (existing) {
      existing[1].push(entry);
    } else {
      groups.push([entry.group, [entry]]);
    }
    return groups;
  }, []);

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex flex-col gap-1">
        <Label>Project Config</Label>
        <span className="text-xs text-muted-foreground">
          Non-secret settings save locally. Credential rows report the injected process environment.
        </span>
      </div>

      {envGroups.map(([group, entries]) => (
        <div key={group} className="space-y-2 rounded-md border border-border/70 p-3">
          <Label>{group}</Label>
          <div className="space-y-3">
            {entries.map((entry) =>
              entry.secret ? (
                <CredentialStatusRow key={entry.name} entry={entry} />
              ) : (
                <EnvInputField
                  key={entry.name}
                  entry={entry}
                  onChange={(value) => updateEnvEntry(entry.name, value)}
                />
              ),
            )}
          </div>
        </div>
      ))}

      <Button size="sm" onClick={onSave} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Project Config"}
      </Button>
      {statusText ? <p className="text-xs text-muted-foreground">{statusText}</p> : null}
    </div>
  );
}

function EnvInputField(props: { entry: RuntimeEnvEntry; onChange: (value: string) => void }) {
  const { entry, onChange } = props;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{entry.label}</Label>
        <ConfigSourceBadge status={entry.status} />
      </div>
      {entry.multiline ? (
        <textarea
          className="min-h-16 w-full rounded-md border bg-background px-2 py-2 font-mono text-xs"
          value={entry.value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={entry.placeholder}
        />
      ) : (
        <Input
          value={entry.value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={entry.placeholder}
        />
      )}
      {entry.description ? (
        <p className="text-xs leading-snug text-muted-foreground">{entry.description}</p>
      ) : null}
    </div>
  );
}

function CredentialStatusRow(props: { entry: RuntimeEnvEntry }) {
  const { entry } = props;
  const commands = credentialSetupCommands(entry.name);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{entry.label}</Label>
        <ConfigSourceBadge status={entry.status} />
      </div>
      {entry.description ? (
        <p className="text-xs leading-snug text-muted-foreground">{entry.description}</p>
      ) : null}
      {entry.status.configured ? (
        <p className="text-xs leading-snug text-emerald-600">
          Available from the injected process environment.
        </p>
      ) : (
        <div className="space-y-1 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
          <p>From this project checkout, add the value to Doppler and restart Farplane:</p>
          <code className="block select-all break-all">{commands.setup}</code>
          <code className="block select-all break-all">{commands.set}</code>
          <code className="block select-all break-all">{commands.run}</code>
          <p>The command prompts for the value; Farplane never stores it in local settings.</p>
        </div>
      )}
    </div>
  );
}

function ConfigSourceBadge(props: { status: RuntimeSecretStatus }) {
  const { status } = props;
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 text-[11px] ${
        status.configured ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
      }`}
    >
      {status.source}
    </span>
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
        placeholder={
          typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5173"
        }
      />

      <InputField
        label="Ephemeral Worker Lifetime"
        type="number"
        min={1}
        value={form.recentMinutes}
        onChange={(value) => patchForm({ recentMinutes: value })}
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        Shows ordinary Codex thread workers, and their desks, while they were active within this
        many minutes. Persistent PM, CEO, running, and automation heartbeat threads ignore this
        timer.
      </p>

      <ToggleRow
        label="Persistent Automation Heartbeats"
        description="Keep strategy or heartbeat automations visible; scheduled task-drainer runs still age out."
        enabled={form.showAutomationThreads}
        onToggle={() => patchForm({ showAutomationThreads: !form.showAutomationThreads })}
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
        {isSaving ? "Saving..." : "Apply Worker Visibility"}
      </Button>
      {statusText ? <p className="text-xs text-muted-foreground">{statusText}</p> : null}
    </div>
  );
}

function OpenClawRuntimeSettings(props: {
  connected: boolean;
  gatewayBase: string;
  stateBase: string;
  defaultSessionKey: string;
  language: string;
  onGatewayBaseChange: (value: string) => void;
  onStateBaseChange: (value: string) => void;
  onDefaultSessionKeyChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onConnectGateway: () => void;
  onRefreshGatewayConfig: () => void;
}) {
  const {
    connected,
    gatewayBase,
    stateBase,
    defaultSessionKey,
    language,
    onGatewayBaseChange,
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
      <p className="text-xs leading-snug text-muted-foreground">
        Gateway credentials are injected into the UI process environment and are not saved here.
      </p>
      <InputField
        label="State Bridge URL"
        value={stateBase}
        onChange={onStateBaseChange}
        placeholder={
          typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5173"
        }
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
