---
template_id: ticket-template
template_version: "0.1.3"
ticket_id: TASK-0038
title: Render canonical Agent Skills eval schema
phase: proof
status: review
owner: codex
claimed_by: codex-019f4de3
priority: high
depends_on: []
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-07-12T00:00:00+08:00
updated_at: 2026-07-12T00:00:00+08:00
next_action: complete independent re-review, stage task-owned changes, and commit
last_verification: "2026-07-12: 13 focused tests, 733 full tests, root build, UI build, and browser QA passed"
---

# TASK-0038: Render Canonical Agent Skills Eval Schema

## Summary

Update Skill Studio and Skill OS to ingest and render the canonical portable
Agent Skills eval suite at `skills/<skill>/evals/evals.json`. Remove the retired
retired skill-local single-file and alias-based model while keeping
global Farplane harness run tasks on their distinct runner-native contract.

## Scope

- In: skill registry/file ingestion, strict eval types and normalization, catalog/detail APIs,
  Skill Studio and Skill OS rendering, graph/detail data, fixtures, tests, and owning docs.
- Out: global Eval OS run artifact schema and global harness runner task semantics.

## Delta

```text
overall_before:
  - Skill-local eval files are generic assets/raw JSON or inferred as hints from SKILL.md.
  - Owning docs still name the retired single-file layout.
overall_after:
  - Registry eval paths resolve strict evals/evals.json suites and typed cases.
  - UI renders prompt, expected_output, files, assertions, and useful metadata.farplane values.
  - No skill-local compatibility aliases or legacy fixtures remain.
why_now:
  - Farplane commit 0dbcd1ace262cc7497ebfc62bd90c8c3e81c683e made this the canonical source contract.
```

## Change Plan

### Change 1: Strict ingestion contract

```text
fixes:
  - Skill files and registry rows do not expose typed canonical eval suites.
read:
  - ui/skill-studio-state.ts
  - ui/src/modules/runtime/lib/openclaw/types.ts
  - Farplane docs/skills/registry.jsonl and representative skills/*/evals/evals.json
write:
  - ui/skill-studio-state.ts
  - ui/src/modules/runtime/lib/openclaw/types.ts
operation:
  - Resolve the registry-relative eval path and accept only the canonical root/case fields.
qa:
  - focused state bridge tests cover valid and invalid suites without legacy fallbacks.
```

### Change 2: Structured skill eval UI

```text
fixes:
  - Skill Studio previews raw JSON and Skill OS shows only markdown-derived eval hints.
write:
  - ui/src/modules/office/components/skills-panel-files-tab.tsx
  - ui/src/modules/skills-studio/components/skill-os/*
operation:
  - Render canonical case fields and useful metadata.farplane values directly.
  - Keep global eval run history visibly separate.
qa:
  - focused model/component tests plus browser QA of affected skill screens.
```

### Change 3: Remove stale skill-local contract references

```text
write:
  - ui/src/modules/evals/AGENTS.md
  - tickets/TASK-0006/designs/03-evals-design.md
  - nearby module docs and fixtures as found
operation:
  - Replace skill-local legacy paths/labels and verify repo-wide search boundaries.
qa:
  - zero active skill-local legacy path or field schema references.
```

## Done / Proof

- [x] Registry rows with `eval: "evals/evals.json"` load a typed canonical suite.
- [x] Skill detail surfaces render prompt, expected output, files, assertions, and useful Farplane metadata.
- [x] Skill graph/detail surfaces expose canonical eval availability and content.
- [x] No legacy alias, fallback parser, dual path, stale label, or active tracked skill-local fixture remains.
- [x] Global harness task rendering retains its intentionally distinct runner-native contract.
- [x] Focused tests, normal validation/build, browser QA, and independent review pass.
- [x] Only task-owned changes are committed.

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa
  checks:
    - focused Vitest for ingestion/types/view models
    - npm run test:once
    - npm run typecheck
    - npm run build
    - npm run ui:build
    - bash scripts/pre_push_check.sh
  manual:
    - open Skill Studio and Skill OS against the Farplane source repo and inspect a representative metadata-rich hardcase suite
  delegated_lanes:
    - independent implementation review after tests and browser evidence
  review:
    - rubric: canonical contract, boundary correctness, maintainability, proof completeness
      required_tas: pass-ready
  evidence:
    - tickets/TASK-0038/artifacts/
  residual_risk:
    - shared dirty ui/vite.config.ts and docs/HISTORY.md require hunk-scoped staging
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - ui/src/modules/skills-studio/README.md
    - ui/src/modules/evals/AGENTS.md
    - tickets/TASK-0006/designs/03-evals-design.md
  validation:
    - repo-wide legacy schema search with global harness exceptions reviewed explicitly
```

## Agent Contract

- Open: `npm run ui`, then open the Skills/Skill OS surface.
- Inspect: suite path/count, case title/tags/hardcase metadata, prompt, expected output, files, assertions.
- Key screens/states: metadata-rich suite, suite without optional metadata, skill without eval suite.
- QA cookbook: start at `qa/README.md` and use the closest module/panel browser flow.
- Expected artifacts: focused test logs, build logs, browser screenshots, review report.

## Links

- `program:` none
- `progress:` none
- `artifacts:` `tickets/TASK-0038/artifacts/`
- `review:` `tickets/TASK-0038/artifacts/independent-review.md`
- `verification:` `tickets/TASK-0038/artifacts/verification.md`
- `refs:` Farplane commit `0dbcd1ace262cc7497ebfc62bd90c8c3e81c683e`; `skills/eval/audits/2026-07-12-agent-skills-eval-layout-migration.md`; `tickets/TASK-0006/ticket.md`

## Notes

- Preserve all unrelated dirty worktree changes. Stage by explicit task-owned paths/hunks.
- `files` is canonical execution input, not display-only metadata; this ticket renders it but does not change runner behavior.
- `bash scripts/pre_push_check.sh` is currently blocked before its gates by unrelated user-owned deletions of the legacy Team Workspace products files; the constituent required tests/builds were run directly and passed.
- Ignored legacy `tickets/building/TKT-*` and `.farplane/*` runtime/history artifacts retain old strings as historical evidence; tracked active skill UI/source/docs have zero retired skill-local schema references.
