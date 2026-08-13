---
kind: system
status: active
project: Farplane UI
created_at: 2026-08-13
owner: ui-runtime
---

# Configuration System

Farplane has one operator-facing Settings experience, but it intentionally has
more than one persistence surface. A setting, a secret, and mutable product
state have different lifecycle and safety requirements.

```text
Settings UI
  ├─ Configurations → ~/.farplane/config.toml      non-secret, local operator defaults
  ├─ Office          → ~/.farplane/office*.json     mutable office state
  ├─ Company/finance  → ~/.farplane/*.json           mutable business state
  ├─ Project policy   → <project>/farplane/*         versioned, shared project policy
  └─ Connections      → Doppler process environment  credentials only
```

## Contract

| Surface | Owns | Editable from UI | Never contains |
| --- | --- | --- | --- |
| `~/.farplane/config.toml` | Non-secret values that vary by operator machine: feature defaults, runtime URLs, local hooks and automation preferences | Yes, through **Settings → Configs** | Credentials and product records |
| `~/.farplane/*.json` sidecars | Mutable Office, company, approval, finance, and layout state | Feature-specific UI flows | Shared project policy or provider secrets |
| `farplane/manifest.json`, `brand.json`, `agents.yaml`, `automations.toml`, `bindings.toml`, `hooks.json`, `pm.json` | Versioned project/team policy | Existing project flows only; no blanket editor | Machine-specific defaults or credentials |
| Doppler/environment | API keys, tokens, passwords, OAuth material, signing keys | Readiness only; the UI shows value-free setup commands | Secret values in browser state, TOML, or sidecars |
| Codex/OpenClaw homes | Runtime-owned authentication and client state | Their own runtime controls | Farplane application policy |

The configuration function is deliberately narrow:

```text
resolve(feature, operator_config, project_policy, runtime_catalog)
  -> effective_nonsecret_settings + validation_evidence
```

Runtime catalog capabilities override a human-entered value only to reject an
unsupported choice; they never silently change the configured setting.

## Feature registry

Feature defaults are declared in `cli/operator-settings.ts`. The initial
registry entry is `video_intelligence.analysis`, persisted as:

```toml
[features.video_intelligence.analysis]
model = "gpt-5.6-terra"
reasoning_effort = "xhigh"
```

The YouTube bridge resolves this profile once per new job, saves the exact
snapshot to the Content job and analysis revision, asks the live Codex
app-server for `model/list`, and refuses to start if the requested
model/effort pair is not advertised. Existing jobs retain their original
snapshot; changing a default only affects future analysis.

## UI shape

```text
┌ Settings ──────────────────────────────────────────────────┐
│ General   Office   [ Configs ]   Comms                       │
├─────────────────────────────────────────────────────────────┤
│ Feature defaults                                              │
│                                                               │
│  Video Intelligence                                           │
│  Every new video analysis snapshots this profile.            │
│                                                               │
│  Analysis model                 Reasoning effort             │
│  [ gpt-5.6-terra            ]   [ Extra high              ] │
│                                                               │
│  Saved to ~/.farplane/config.toml                             │
│  Checked against Codex before analysis starts.                │
│                                                               │
│  [ Save Configuration ]                                       │
│                                                               │
│  ── Runtime & automation ──────────────────────────────────  │
│  Existing non-secret runtime fields and credential readiness  │
└─────────────────────────────────────────────────────────────┘
```

Connections are not a secret editor. A missing credential shows its status and
the exact `doppler secrets set NAME` command, then asks the operator to restart
the affected process. This keeps secret material out of browser memory, local
configuration files, and source control.

## Migration boundaries

Do not merge all JSON into TOML. `office.json`, `office-objects.json`, company,
finance, approvals, and generated runtime state are records, not settings.
Their current feature owners remain correct. New cross-feature non-secret
operator values must enter the typed registry; new shared project policy must
enter the appropriate versioned `farplane/` file. Duplicate legacy readers may
be retired only after an explicit data-preserving migration.
