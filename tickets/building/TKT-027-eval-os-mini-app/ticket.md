---
id: TKT-027
title: Eval OS mini app and run artifact viewer
state: review
owner: Farplane UI
assignee: Codex
created_at: 2026-06-14
complexity: L
---

# TKT-027: Eval OS Mini App And Run Artifact Viewer

## Status

- state: `review`
- owner: Farplane UI
- assignee: Codex
- location: `tickets/building/TKT-027-eval-os-mini-app`
- dependencies: `TKT-023`, `skills/eval/templates/viewer-react`, local eval runner artifact contract
- enter when: operator clarified that Evals is an Eval OS mini app, not a Skill OS tab/list
- leave when: global Evals entrypoint opens a Farplane-native eval dashboard with screenshot proof
- blockers: none
- complexity: `L`

## Description

Replace the current thin `EvalsSurface` inside `skills-panel.tsx` with an
Eval OS mini app. The mini app should be based on the existing eval skill's
React viewer rather than a new invented UI.

The global Evals entrypoint must behave like a test results / eval observability
console: latest run dashboard, overall health score, run history, task grid,
drilldown into a selected eval task, judge/rubric/reference-point breakdown,
artifact paths, and empty/onboarding state when `.farplane/evals` is not
initialized yet.

Skill-local `eval_task.json` remains inside Skill OS. Global Evals is for run
artifacts and historical eval reports.

## Implementation Plan

### 1. New Eval OS Module

Create:

```text
ui/src/modules/evals/
  README.md
  AGENTS.md
  index.ts
  components/eval-os-panel.tsx
  components/eval-run-history.tsx
  components/eval-task-detail.tsx
  components/eval-task-grid.tsx
  components/eval-health-score.tsx
  lib/eval-artifacts.ts
  lib/eval-health.ts
  lib/eval-types.ts
```

Initial implementation may be smaller if files stay below project size limits,
but Eval OS must be module-owned and not grow `skills-panel.tsx`.

### 2. Data Contract

Use the existing eval runner contract:

```text
.farplane/evals/runs/index.json
.farplane/evals/runs/<job_id>/summary.json
.farplane/evals/runs/<job_id>/tasks/<task_id>.json
.farplane/evals/runs/<job_id>/tasks/<task_id>/agent_answer.txt
```

Add Vite bridge endpoints:

```text
GET /farplane/evals/runs
GET /farplane/evals/runs/latest
GET /farplane/evals/runs/:jobId
GET /farplane/evals/runs/:jobId/tasks/:taskId
GET /farplane/evals/runs/:jobId/tasks/:taskId/agent_answer.txt
```

If `.farplane/evals` is missing, return a structured empty response; do not
show a fake pending latest run.

### 3. UI Shape

First viewport:

```text
Evals
+--------------------------------------------------------------------+
| Health  Latest run  Pass rate  Failures  Runs  Task details loaded |
+--------------------------------------------------------------------+
| Run History Rail        | Latest Run / Selected Run Dashboard       |
| - run id / label        | verdict bars / trend / metadata           |
| - pass rate / date      | filters: all, pass, fail, A-D, hardcase    |
| - suite / harness       |                                           |
|                         | Task Grid                                  |
|                         | [task card][task card][task card]          |
+-------------------------+-------------------------------------------+
| Task Detail Drawer / Pane                                           |
| prompt, agent answer, judge reason, rubric, reference points, paths |
+--------------------------------------------------------------------+
```

Required states:

- empty/onboarding state when no eval run index exists
- latest run dashboard when artifacts exist
- previous run selection / time travel
- task search and verdict filter
- selected task detail with judge and reference-point results
- manual JSON file loading fallback from the existing viewer

### 4. Integration

- Keep global launcher `Evals` from TKT-023.
- In `SkillsPanel`, when `surface === "evals"`, render the Eval OS mini app
  full-width and hide the skill sidebar because Evals is not skill selection.
- Preserve Skill OS file viewer for `eval_task.json`.
- Do not put Evals as a nested tab under Skill OS.

### 5. Storage Stance

Local-first for this ticket. Persist reports as files from the runner. Convex
is a later cloud-mode concern only if reports need sharing, multi-device
history, or saleable aggregate data.

## Acceptance Criteria

- [x] AC-1: `Evals` global entrypoint opens an Eval OS mini app, not the Skill OS sidebar/list.
- [x] AC-2: Eval OS reads local eval run artifacts through Farplane endpoints.
- [x] AC-3: Missing `.farplane/evals` shows a useful empty/onboarding state.
- [x] AC-4: Latest run dashboard renders health score, pass rate, task count,
  verdict distribution, failures, harness/judge/suite metadata, and loaded detail count.
- [x] AC-5: Run history supports selecting a previous run from `runs/index.json`.
- [x] AC-6: Task grid supports search and verdict/pass/fail filters.
- [x] AC-7: Task detail renders task query, agent answer, judge reason, rubric,
  reference-point results, tags/notes, and artifact paths when detail JSON exists.
- [x] AC-8: Manual summary/detail JSON loading from the existing viewer is preserved.
- [x] AC-9: Skill-local `eval_task.json` remains in Skill OS and is not the global Evals primary model.
- [x] AC-10: UI uses Farplane/shadcn dark office style and avoids nested scrolling problems.
- [x] AC-11: Browser screenshots prove empty state and/or populated state, plus the global entrypoint route.

## Agent Contract

- Read:
  - `skills/eval/SKILL.md`
  - `skills/eval/templates/viewer-react/src/App.tsx`
  - `ui/src/modules/office/components/skills-panel.tsx`
  - `ui/vite.config.ts`
  - nearest module `AGENTS.md` files
- Implement:
  - endpoint bridge for eval artifacts
  - Eval OS module
  - Skills panel integration that hides skill sidebar for Evals
- Verify:
  - focused Biome check
  - focused Vitest for eval artifact parsing/health helpers
  - filtered typecheck for touched files
  - Playwright screenshots

## Evidence Checklist

- [x] Screenshot: global speed dial still exposes `Evals`
- [x] Screenshot: Evals opens as full Eval OS mini app without skill sidebar
- [x] Screenshot: empty/onboarding state if no local runs exist
- [x] Screenshot: populated sample/latest run dashboard
- [x] Screenshot: run history selection
- [x] Screenshot: task detail drilldown
- [x] Endpoint snapshot for eval run endpoints
- [x] QA report linked

## Artifact Links

- Goal program: `tickets/building/TKT-027-eval-os-mini-app/program.md`
- Goal progress: `tickets/building/TKT-027-eval-os-mini-app/progress.md`
- Generated Goal prompt: `tickets/building/TKT-027-eval-os-mini-app/generated-goal-prompt.md`
- QA report: `tickets/building/TKT-027-eval-os-mini-app/artifacts/qa-2026-06-14-eval-os/qa-report.md`
- Empty screenshot: `tickets/building/TKT-027-eval-os-mini-app/artifacts/qa-2026-06-14-eval-os/eval-os-empty-clean.png`
- Populated screenshot: `tickets/building/TKT-027-eval-os-mini-app/artifacts/qa-2026-06-14-eval-os/eval-os-sample-dashboard-clean.png`
- Task detail screenshot: `tickets/building/TKT-027-eval-os-mini-app/artifacts/qa-2026-06-14-eval-os/eval-os-task-detail.png`
- Auto-load screenshot: `tickets/building/TKT-027-eval-os-mini-app/artifacts/qa-2026-06-14-eval-os-autoload/eval-os-autoload-latest-run.png`
- Mock eval run snapshot: `tickets/building/TKT-027-eval-os-mini-app/artifacts/mock-eval-run-2026-06-14/summary.json`

## Required Evidence

- [x] Focused lint passes
- [x] Focused tests pass
- [x] Filtered typecheck shows no touched-file errors, or full typecheck passes
- [x] Browser screenshots prove required UI states
- [x] QA report reconciles screenshots against acceptance criteria
