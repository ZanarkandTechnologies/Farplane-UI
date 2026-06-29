---
title: "Harness Panel Design"
ticket_id: TASK-0006
status: draft
owner: farplane-ui
created_at: 2026-06-24
updated_at: 2026-06-24
kind: design
refs:
  - ../../TASK-0006/ticket.md
  - ../../../ui/src/modules/harness-os/
  - /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/farplane-framework/harness-maintenance.md
---

# Harness Panel Design

## User Stories

- As an operator, I want to know if the harness is healthy before I trust it.
- As an operator, I want to understand how the harness works without reading
  five docs.
- As an operator, I want to see which projects/features/templates are adopted
  and which are drifting.

## Data Sources

```text
Health:
  validator command results
  generated artifact freshness
  registry sync status
  rollout summary counts

Map:
  farplane-lifecycle-graph.json
  harness-graph.json
  skill-graph.json when cross-linked

Rollout:
  python3 bin/farplane.py adoption scan --json
  python3 bin/farplane.py skills rollout scan --json
  skill-template-intelligence.json
```

## Panel Shell

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ HARNESS                                                   refreshed 11:52 AM │
│ Health, map, and rollout state for the Farplane harness.        [Refresh All]│
├──────────────────────────────────────────────────────────────────────────────┤
│ [Health] [Map] [Rollout]                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Health Tab

Purpose: "Is the harness okay, and where should I look next?"

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ HARNESS / HEALTH                                               [Refresh All] │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Checks] [Registries] [Freshness]                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Projects     │ │ Skills       │ │ Templates    │ │ Checks       │        │
│  │ 4 scanned    │ │ 82 current   │ │ 3 stale      │ │ 2 failing    │        │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                                              │
│  Maintenance pipeline                                                        │
│  declarations -> registries -> rollout reports -> graph projections -> UI    │
│                                                                              │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ ATTENTION                            │ SELECTED / NEXT ACTION                │
│                                      │                                       │
│  ! sync_skill_registry       stale   │ sync_skill_registry                   │
│  ! check_doc_refs            failed  │ command                               │
│  ! template rollout          stale   │ python3 bin/validators/... --check    │
│  ✓ lifecycle graph           fresh   │                                       │
│                                      │ owner                                 │
│                                      │ registry/source declaration            │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

Health group behavior:

```text
Overview   -> summary cards + attention queue
Checks     -> validator list, last run, pass/fail, command, owner source
Registries -> features/templates/skills counts and stale sync status
Freshness  -> generated graph/report timestamps and stale-output checks
```

## Map Tab

Purpose: "How does the harness work?"

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ HARNESS / MAP                                                    Generated  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Lifecycle] [Graph] [Guardrails] [References]                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐            │
│  │ Project initialization      │  │ Automation activation        │            │
│  │ 7 states · curated          │  │ 8 states · curated           │            │
│  └──────────────┬──────────────┘  └──────────────┬──────────────┘            │
│                 │                                │                           │
│  ┌──────────────▼──────────────┐  ┌──────────────▼──────────────┐            │
│  │ Ticket -> Native Goal       │  │ Memory + Drain Upkeep       │            │
│  │ 9 states · curated          │  │ 8 states · curated           │            │
│  └─────────────────────────────┘  └─────────────────────────────┘            │
│                                                                              │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ FSA PROJECTION                       │ SELECTED NODE/STAGE                   │
│ [Project Init] [Automation]          │ Project initialization                 │
│ [Ticket Goal] [Memory Drain]         │ evidence: graph-contract.md            │
│                                      │ confidence: curated                    │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

Map group behavior:

```text
Lifecycle  -> FSA projections and current cockpit
Graph      -> raw graph explorer with filters
Guardrails -> hooks, gates, QA/review/demo/check paths
References -> harness-reference graph and unresolved reference audit
```

## Rollout Tab

Purpose: "Where is the harness adopted, missing, or drifting?"

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ HARNESS / ROLLOUT                                                [Scan Roots]│
├──────────────────────────────────────────────────────────────────────────────┤
│ [Projects] [Features] [Templates] [Skill Templates] [Drift]                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Projects 4 │ Manifests 3 │ Local skills 2 │ Drift 1 │ Standard spec 1.3.0   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Project      Manifest   Spec          Templates       Features    Drift      │
│ Farplane     ok         1.3 / 1.3     framework@1.3   1 implied   0          │
│ Client A     missing    -             -               -           1          │
│ Client B     ok         1.2 / 1.3     framework@1.2   0           2          │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ FEATURE ROLLOUT                      │ SELECTED PROJECT                      │
│ FEAT-0060 implemented  implied: 1    │ Client B                               │
│ FEAT-0061 registered   adopted: 0    │ spec drift: 1.2 expected 1.3           │
│                                      │ source to fix: farplane/manifest.json  │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

Rollout group behavior:

```text
Projects        -> project manifest/spec/template/feature/local-skill table
Features        -> feature rollout matrix, explicit vs implied adoption
Templates       -> high-impact template consumers current/stale/missing
Skill Templates -> skill-template rollout current/stale/missing/external
Drift           -> issues grouped by fix owner/source declaration
```

## Empty / Error States

```text
No lifecycle graph:
  "Lifecycle graph is not installed. Run graph projection generation."
  action: Show command

No adoption roots:
  "No project roots selected."
  actions: Add roots file, scan current project

Validator command failed:
  show command, exit status, stderr excerpt, source owner

Stale generated artifact:
  show generated_at, expected command, check command
```
