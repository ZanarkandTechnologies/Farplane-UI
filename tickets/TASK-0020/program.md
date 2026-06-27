---
ticket_id: TASK-0020
title: Goal Program - Chat History Mining Programs Platform
status: active
created_at: 2026-06-28
updated_at: 2026-06-28
loop_shape: active_goal
approval: approved
metric_provider: hybrid
proof_route: qa_evidence_subagent + completion_review_subagent
---

# TASK-0020 Program

## Objective

Implement the Chat History Mining Programs Platform as a Thread Data workbench:
program CRUD, source filtering, job/run creation, file-backed outputs, progress
viewing, output review, and a first usable bundled program path.

## Files

- `tickets/TASK-0020/ticket.md`
- `tickets/TASK-0020/design.md`
- `tickets/TASK-0020/program.md`
- `tickets/TASK-0020/progress.md`
- `tickets/TASK-0020/generated-goal-prompt.md`

## Execution Policy

- Shape: `active_goal`.
- Work until the ticket Done / Proof is satisfied, blocked by a real missing
  input, or a safe continuation requires a separate branch/thread.
- Preserve unrelated dirty worktree changes.
- Prefer existing Farplane UI module boundaries and local bridge/runtime
  patterns.
- Keep the first implementation useful but bounded:
  - file-backed program definitions
  - file-backed backfill jobs/runs
  - UI shell/tabs for Thread Data
  - fixture or local-file proof for job outputs
  - at least one bundled program path
- Do not claim real background scalability unless proven.

## Metric / Feedback Provider

Hybrid:

- Mechanical checks pass for touched code.
- UI evidence shows the Thread Data / Backfill workflow renders and supports the
  main states.
- QA evidence subagent produces a browser/user-visible evidence report.
- Completion review subagent judges Done / Proof and evidence sufficiency.

Guard metrics:

- No raw transcript body stored in Convex.
- Output files stay under `.farplane/backfill/jobs/<jobId>/`.
- Generated outputs include program id/version and source session id.
- UI distinguishes generated outputs from reviewed/promoted outputs.

Anti-metrics:

- A table-only mock with no run/output state.
- A hidden agent workflow with no visible progress.
- Hardcoding only `trajectory-v1` as the product.
- Claiming completion without screenshot evidence and delegated review.

## Budget

- Time: current active Goal window.
- Token/model: not specified.
- Compute: local development only.
- Subagents: use at least two delegated lanes before completion:
  - `qa_evidence_subagent` for browser/runtime proof and screenshots.
  - `completion_review_subagent` for final Done / Proof review.
- Spend/deploy: none.

## Drift Policy

Before each stop:

- Compare changed behavior against `ticket.md`, `design.md`, and this program.
- Log a compact progress entry in `progress.md`.
- If scope drifts into unrelated telemetry, TASK-0019 live Stop-hook work, or
  full eval-engine design, stop and re-scope.
- Completion cannot be self-certified. It requires delegated QA evidence and
  delegated completion review.

## Proof Route

Required:

1. Focused tests for new data/model helpers, bridge handlers, and UI state where
   practical.
2. Typecheck/build command appropriate to touched files.
3. Browser/user-visible QA evidence:
   - screenshot of Thread Data panel
   - screenshot of Programs/Backfill/Runs or equivalent workflow state
   - console/page error notes
4. Completion review subagent:
   - inspect ticket/program/progress/design
   - inspect changed files and evidence
   - return pass/needs-revision with concrete blockers

Final response must include the strongest screenshot evidence as Markdown image
syntax, or explicitly block with the missing proof.

