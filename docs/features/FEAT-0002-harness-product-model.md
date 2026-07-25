# FP02: Harness Product Model

**Status**: Draft
**Created**: 2026-06-24
**Owner**: Farplane UI
**Source idea**: Farplane is the cloneable harness substrate; Farplane UI is the cockpit for global harness operations and project-specific autonomous companies.

## Purpose

Farplane should be understood as a personal harness system, not only as one
office UI around an agent runtime.

Anyone who wants to run this style of AI work should be able to clone Farplane,
make it their own harness, and then evolve that harness over time: skills,
evals, standards, templates, tickets, automations, runtime adapters, goals,
guardrails, and self-improvement loops.

Farplane UI is the operator cockpit for that harness. It exposes global harness
surfaces for using and maintaining Farplane itself, then opens project-specific
views where each project behaves like an autonomous company with its own goals,
teams, agents, files, metrics, and operating loop.

## Product Definition

```ts
type Farplane = CloneableHarnessSubstrate;
type FarplaneUI = HarnessCockpit;

function cloneFarplane(operator: Person | Team): PersonalHarnessRepo;

function openFarplaneUI(scope: "global" | ProjectId):
  | GlobalHarnessSurface
  | AutonomousCompanySurface;
```

- **Farplane** is the cloneable repo and framework for building a custom AI
  operating harness.
- **Farplane UI** is the local app that makes the harness visible, usable, and
  steerable.
- **Global surfaces** are UIs for using and maintaining Farplane itself.
- **Project-specific surfaces** are autonomous company views: a project becomes
  the unit with goals, teams, agents, work state, evidence, memory, and metrics.

## Mental Model

```text
operator clones Farplane
  -> owns a personal harness repo
    -> maintains global harness capabilities
      -> skills, evals, templates, rollout, settings, user comms
    -> runs project/company views
      -> project goals
      -> teams / agents
      -> board / tickets
      -> files / memory / evidence
      -> metrics / review / automation loops
```

The harness is not supposed to be identical for every operator forever. The
point is that each operator can start from the shared Farplane substrate, then
adapt it into their own standards, skills, evals, templates, guardrails, and
self-improvement machine.

## Global Surfaces

Global surfaces answer: "How is my harness doing, and what tools do I have?"

Examples:

- **Harness Map**: the graph, lifecycle, and feature registry for the harness.
- **Skill OS**: the global skill registry, graph, standards, and per-skill
  details.
- **Eval OS**: eval runs, tasks, reports, and readiness signals.
- **Rollout**: project-level Farplane/framework adoption.
- **Template Tracking**: manifest and template-family version adoption.
- **User Comms**: operator communication channels and routing.
- **Settings**: runtime adapter, local state, and app configuration.

Global surfaces should be useful even before a specific project is selected.
They are the operator's control room for the harness itself.

## Project-Specific Surfaces

Project surfaces answer: "How is this autonomous company doing?"

A project-specific view should treat the project as a company-like operating
unit, not as a folder browser. It can still expose files directly, but the
primary job is to make the company's operating loop visible:

- mission, goals, KPIs, and current phase
- active teams and agents
- ticket state and current execution
- local memory, docs, artifacts, and evidence
- project-specific skill needs and eval readiness
- automation, review, metrics, and rollout state

The same first-party modules may appear globally and inside a project. The
difference is scope:

```ts
moduleView(module, "global") -> portfolio_rollup;
moduleView(module, projectId) -> autonomous_company_panel;
```

## File Event Layer

Project files are part of the operating loop, not only passive documents.
Farplane should capture important tracked file changes as typed facts that can
feed timeline views, audits, and later automation routing.

The local file-change hook is the first capture surface. It emits compact
`farplane.*` events for ticket lifecycle files, project goals/products/harness
docs, automation/binding files, selected memory docs, and config JSON. The
event payload is factual and privacy-bounded: changed field names, short
previews or hashes, section hints, content hash, entity ids, and terminal flags.
It does not include raw file bodies, transcripts, or job-routing decisions.

Future Kanban or document providers should publish the same normalized event
shape with provider metadata instead of inventing separate timeline contracts.

## Mining Run Layer

Farplane should process flexible signals through replayable mining runs instead
of one-off hook workers or provider-specific job stores. A mining run is the
artifact-first unit that owns its input, sources, attempts, outputs, redaction
state, verdicts, telemetry, and replay metadata.

Historical chat backfills, hook-triggered event processing, manual selected
threads, and ticket-completion scoring should use the same `.farplane/mine`
runtime contract. Events remain factual inputs; mining programs interpret those
inputs into reviewable outputs. Codex threads, `codex exec`, and local workers
are executors attached to a run, not the durable record of truth.

The local browser route for mining is `/farplane/mine/*`, but route transport is
not the mining owner. Vite delegates those routes to server-owned mining modules
so source normalization, replay, verdicts, and filesystem safety can be tested
without starting the frontend dev server.

## Clone And Rollout Implication

Because every serious operator may clone and customize Farplane, version
visibility matters.

Template and rollout UIs should not pretend to score business outcomes before
the metric contract exists. Their first job is simpler:

- show which Farplane/framework version each project is on
- show which template families exist
- show which versions are adopted
- show which template families are unversioned or not yet scanned
- link to the owning project/company view when remediation is needed

This is why **Rollout** and **Template Tracking** are separate from Harness Map:
Harness Map explains what the harness is; Rollout and Template Tracking explain
which projects and template families have adopted which versions.

## Product Boundaries

Farplane is not:

- a generic multi-tenant SaaS by default
- a single fixed company simulator that everyone uses unchanged
- only a 3D office skin over agent sessions
- a replacement for runtime adapters such as Codex or OpenClaw
- a metrics dashboard that invents quality scores without evidence

Farplane is:

- a cloneable harness repo
- a local-first operating substrate for AI work
- a set of standards, templates, skills, evals, tickets, automations, and
  guardrails that can improve over time
- a cockpit for global harness operation and project-specific autonomous
  companies

## UI Hierarchy Rule

Root launcher entries should match operator jobs, not internal implementation
folders.

- Put `Harness Map`, `Skill OS`, `Eval OS`, `Rollout`, `Template Tracking`,
  `User Comms`, and `Settings` at the global level when they are frequent
  operator entrypoints.
- Keep project/company work inside project-scoped panels unless the global
  view is a true portfolio rollup.
- Do not make fake or legacy panels look first-class just because a component
  still exists.
- Do not duplicate the same concept under two labels. If an old route remains
  for compatibility, it should open the canonical surface.

## Relationship To FP01

FP01 defines the operator-intelligence modules and the rule that modules often
need both global and project/team scoped views. FP02 explains the product model
behind that rule: global views operate the harness; scoped views operate an
autonomous company.
