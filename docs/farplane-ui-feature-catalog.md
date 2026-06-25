---
title: Farplane UI Feature Catalog
status: active
owner: Farplane UI
updated_at: 2026-06-24
---

# Farplane UI Feature Catalog

## Current Launcher Catalog

The main office dial should expose current operator surfaces only. Avoid nesting a
surface under a parent whose name implies the wrong ownership.

| Launcher | Shape | Surface | Status |
| --- | --- | --- | --- |
| People | parent | Organization | keep |
| Work | direct | User Comms | keep |
| Harness | direct | Harness Map | keep |
| Skills | direct | Skill OS | keep |
| Evals | direct | Eval OS | keep |
| Rollout | direct | Rollout | keep |
| Templates | direct | Template Tracking | keep |
| Library | parent | Resource Bank, Docs Library | keep |
| Observe | parent | Harness Usage, Raw Telemetry | keep |
| Build | parent | Builder Mode, Decoration | keep |
| Settings | direct | Settings | keep |

## Harness Surfaces

Harness is the control-plane area for framework structure, not a catch-all
health dashboard.

| Surface | Purpose | Primary Data |
| --- | --- | --- |
| Harness Map | Semantic graph, lifecycle, and feature registry | generated harness graph, lifecycle graph, template intelligence |
| Rollout | Project-level Farplane/framework rollout | adoption scan project rows |
| Template Tracking | Manifest and template version audit | template-tracking scan, adoption scan, skill rollout summary |

## Rollout Scope

Rollout should stay boring and truthful:

- Projects: which Farplane framework/template version each project uses.

Do not show drift/feature score panels until there is a real metric contract. Feature
registry belongs in Harness Map, not Rollout. Template families belong in Template
Tracking, not Rollout.

## Template Tracking Scope

Template Tracking is an audit surface, not a second rollout surface.

- Project manifest: `farplane/manifest.json` `template_uses`.
- Project config templates: `farplane/README.md`, `harness.md`, `goals.md`,
  `automations.md`, `bindings.md`, and `evals.md` frontmatter versions.
- Ticket loop: `tickets/templates/ticket.md`.
- Goal packet: tracked as a scanner gap until a central versioned template exists.
- Skill template: summarized from Skill OS rollout data; per-skill detail stays in Skill OS.
- Skill QA checklist and eval task templates: tracked as scanner gaps until dedicated
  manifest scans exist.
- Workspace templates: `AGENTS-*`, `HEARTBEAT-*`, and `SOUL-*`.
- Sidecar templates: company, office, office objects, Codex office, and pending approvals.
- Runtime adapter templates: OpenClaw config and agents list.

## Removed From Main Dial

| Surface | Reason |
| --- | --- |
| Back to Landing | Not an operator feature; browser/app navigation already handles this. |
| CEO Workbench | Legacy/fake-data surface. |
| Human Review | Legacy/fake-data surface. |
| Team Workspace | Removed from dial until it represents a current real workflow again. |
