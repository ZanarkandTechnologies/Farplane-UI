---
template_id: ticket-template
template_version: "0.1.3"
feature_refs:
  - FEAT-0004
ticket_id: TASK-0052
title: Central Command Commons office self-improvement loop
phase: proof
status: review
owner: codex
claimed_by: codex-current-task
priority: high
depends_on: []
blocked_by: []
ready: true
approval_required: true
requires_qa: true
requires_demo: true
created_at: 2026-07-14T17:15:30+08:00
updated_at: 2026-07-14T21:36:00+08:00
next_action: await the operator verdict on the independently A-graded candidate
last_verification: cycle 36 rendered at 1680x960 with 23% empty and 100% walk; cycle 35 received an independent low-A visual-QA grade; 128 focused tests and root typecheck passed
decision_refs:
  - tickets/TASK-0052/design.md
  - operator message at 2026-07-14T17:15:30+08:00 granting full control and requesting screenshot-feedback iterations
  - operator message at 2026-07-14T17:45:00+08:00 requesting goal-advisor execution against the supplied reference until A
  - tickets/TASK-0052/artifacts/operator-reference-command-office.png
---

# TASK-0052: Central Command Commons office self-improvement loop

## Summary

Replace the technically valid but aesthetically rejected Office3D layout with
the operator-approved Central Command Commons composition. Work proceeds as a
human-feedback self-improvement loop: implement one bounded spatial hypothesis,
render the real default-camera scene, request an explicit operator verdict,
and only then keep, revise, or discard the candidate and consider a reusable
`interior-design` skill lesson.

## Scope

- In:
  - compact central command anchor and surrounding desk neighborhoods
  - shallow, contiguous, traversable activity bays on two outer walls
  - shared architectural, furniture, material, scale, and lighting grammar
  - composition metrics plus browser screenshot evidence every cycle
  - human feedback and measured skill-memory writeback
- Out:
  - photorealism or a renderer replacement
  - deploys, purchases, external publishing, or destructive migrations
  - unrelated standard-renderer UI restyling
  - promoting one-off taste preferences into the skill contract

## Delta

```text
overall_before:
  - pale rectangular tray, row-like furniture, isolated destination patches
  - three-sided 5x5 landmark rails can enlarge the shell
  - build, collision, and reachability can pass while the office remains ugly
overall_after:
  - one central command commons establishes focal hierarchy
  - compact desk neighborhoods and shallow perimeter bays read as one office
  - every visual cycle is judged from a real default-camera screenshot by the operator
why_now:
  - repeated local room, scale, placement, and palette changes were rated F
first_principles_basis:
  objective: make the office read as a dense, classy founder control room
  need: whole-room composition, not another isolated prop or color adjustment
  assumptions: current React Three Fiber primitives can express the accepted blockout
  root_cause: layout optimizes placement legality and connectivity without a focal composition model
  constraints: preserve agent navigation, persisted manual layouts, semantic activity targeting, and fixed isometric readability
  first_viable_slice: app-faithful greybox with central anchor, compact teams, and shallow bays
  proof_or_falsification: operator judges the real default-camera screenshot
  tradeoff: less per-landmark novelty in exchange for one coherent office world
  non_goals: exact replication of the generated concept render in the first cycle
```

## Change Plan

### Change 1: integrated app-faithful composition greybox

```text
fixes:
  - no primary anchor and too much residual floor
before:
  - required team objects seed a core and landmarks expand three uniform room rails
after:
  - a visible primitive command anchor, compact team neighborhoods, and visible two-wall shallow bays define the shell
read:
  - path: ui/src/modules/office/lib/office-layout-solver.ts
    reason: auto-layout phase owner
  - path: ui/src/modules/office/lib/activity-destination-ring.ts
    reason: current three-sided destination planner
write:
  - path: ui/src/modules/office/lib/central-command-commons.ts
    change: pure composition planner and scene-relative metrics
  - path: ui/src/modules/office/lib/office-layout-solver.ts
    change: route automatic landmark layouts through the accepted strategy
  - path: ui/src/modules/office/components/command-commons.tsx
    change: render the minimum visible greybox anchor with agent-scale stations
  - path: ui/src/modules/office/components/activity-landmark.tsx
    change: render a minimum shallow-bay inset instead of the old room-sized slab
operation:
  - place and render the command anchor first, distribute teams around it, attach and render contiguous shallow bays, then derive the minimum rectangular shell
signature_or_type_impact:
  - solveCentralCommandCommons(input) -> anchor + team placements + bay slots + floor tiles + metrics
routes:
  docs: doc-advisor
  qa: visual-qa
  review: reviewer
qa:
  - focused pure planner tests
  - default-camera screenshot visibly showing the central anchor, compact teams, shallow bays, and circulation before material polish
failure_modes:
  - central anchor becomes an oversized obstacle
  - shell remains large because old 5x5 room capacity still controls growth
```

### Change 2: refine the accepted command anchor and shallow landmark grammar

```text
fixes:
  - no focal furniture and destination rooms read as detached colored stages
before:
  - approved primitive greybox anchor and minimal bay insets
after:
  - one refined agent-scaled command table and shallow traversable bays using a shared architectural kit
read:
  - path: ui/src/modules/office/components/round-team-table.tsx
    reason: existing procedural multi-station table
  - path: ui/src/modules/office/components/activity-landmark.tsx
    reason: destination floor and prop renderer
write:
  - path: ui/src/modules/office/components/command-commons.tsx
    change: refine the accepted procedural anchor with deterministic activity spots
  - path: ui/src/modules/office/components/activity-landmark.tsx
    change: replace room slab with restrained inset and shared shallow-bay framing
operation:
  - reuse primitives and shared materials before introducing external 3D assets
signature_or_type_impact:
  - landmark dimensions become shallow-bay dimensions rather than fixed room minimums
routes:
  docs: doc-advisor
  qa: visual-qa
  review: reviewer
qa:
  - scale and navigation tests
  - screenshot comparison at fixed camera
failure_modes:
  - decorative detail hides weak massing
  - landmark equipment blocks employee activity positions
```

### Change 3: unified material and lighting pass

```text
fixes:
  - hardcoded pale furniture and flat white illumination fragment the scene
before:
  - theme owns landmarks but not the complete office material system
after:
  - furniture, shell, landmarks, screens, and practical lights share one restrained theme
read:
  - path: ui/src/config/office-theme.ts
    reason: first-class office theme primitive
  - path: ui/src/modules/office/scene/office-lighting.tsx
    reason: global lighting rig
write:
  - path: ui/src/config/office-theme.ts
    change: add architecture, furniture, surface, and practical-light tokens
  - path: ui/src/modules/office/scene/office-lighting.tsx
    change: reduce flat ambient fill and add composition-derived practical lights
operation:
  - apply the accepted graphite, walnut, stone, muted olive, petrol-grey, and warm-light grammar
signature_or_type_impact:
  - OfficeTheme expands to complete interior tokens
routes:
  docs: doc-advisor
  qa: visual-qa
  review: reviewer
qa:
  - theme tests, performance guard, fixed-camera screenshot
failure_modes:
  - dark palette reduces agent readability
  - too many real-time lights regress performance
```

## Reward

```yaml
kpi_rewards:
  - reward_id: office3d-central-commons-v1
    kpi_id: operator_visual_verdict
    expected_reward: operator rates the real default-camera result A/B or explicitly approves it
    check_in_at: 2026-07-14T17:15:30+08:00
    actual_result: independent visual QA graded the compact reference-aligned command office A (low A); terminal operator signal pending
    decision: monitor
    evaluated_at: 2026-07-14T21:33:00+08:00
    evaluation_key: task-0052-cycle-35-internal-a
    supersedes_evaluation_key:
    evidence_refs:
      - tickets/TASK-0052/artifacts/cycle-35/default-camera.png
      - tickets/TASK-0052/artifacts/cycle-36/default-camera.png
      - tickets/TASK-0052/artifacts/reviews/cycle-35-visual-qa.md
      - tickets/TASK-0052/artifacts/reviews/completion-review-1.md
      - tickets/TASK-0052/artifacts/reviews/completion-review-2.md
```

## Done

```text
done_when:
  - PASS: independent visual-QA graded cycle 35 A against the operator reference before it was shown
  - PENDING HUMAN GATE: operator approves the A-candidate or supplies the next correction
  - PASS: automatic office reports 100% walk at the fixed isometric camera
  - PASS: final browser evidence, visual-QA review, and TAS-A completion review are linked
  - PASS: reusable lesson retained in this ticket pending operator confirmation before skill promotion
```

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa
  checks:
    - pure planner and footprint tests
    - route reachability and collision checks
    - default-camera render with current representative office data
    - build and relevant focused tests after the visual direction is accepted
  manual:
    - compare occupied mass, largest dead patch, anchor visibility, landmark coherence, object-to-agent scale, and path widths
  delegated_lanes:
    - visual-qa after every material implementation candidate
    - reviewer before final completion
  review:
    - rubric: operator verdict plus interior-design QA checklist
      required_tas: pass
  evidence:
    - tickets/TASK-0052/artifacts/cycle-*/default-camera.png
    - tickets/TASK-0052/feedback.json
  goal_advisor_inputs:
    proof_route: visual-qa plus human feedback
    final_evidence: include the best default-camera screenshot in Markdown
    final_checkpoint: QA evidence review and reviewer completion receipt
  residual_risk:
    - generated concept art is directional and cannot certify app-faithful visual quality
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - ui/src/modules/office/README.md after behavior stabilizes
    - docs/HISTORY.md after operator acceptance
    - interior-design self-improve memory only for reusable measured lessons
  validation:
    - doc references and skill validators
```

## Agent Contract

- Open: `npm run ui`, then `/office` with `renderer=office3d`.
- Test hook: existing office debug/QA controls and fixed 2.5D camera.
- Stabilize: use the same representative office/company data across cycles.
- Inspect: office quality HUD, console, scene screenshots, and solver debug stages.
- Key states: baseline, greybox, material candidate, accepted final.
- Design baseline: `tickets/TASK-0052/design.md`.
- QA cookbook: `qa/cookbook/office.md`.
- Taste refs: `docs/TASTE.md`.
- Expected artifacts: default-camera PNG per cycle plus feedback and review receipts.

## Run Hints

- Likely size: epic
- Goal recommendation: required
- Budget hint: one bounded visual hypothesis per feedback cycle; no external spend
- Compute hint: local_shared
- Planning hint: impl_plan complete in this ticket
- QA source: QA Strategy
- Batchability: single-ticket
- Human inputs/assets: operator reference image plus verdict on the internally A-graded candidate
- Human gates: do not interrupt the operator for intermediate screenshots; return only after delegated visual-QA grades the real render A
- Agent decision boundaries: no deploy, purchases, destructive migrations, or skill hardening without measured reusable feedback

## Links

- `program:` `tickets/TASK-0052/program.md`
- `progress:` `tickets/TASK-0052/progress.md`
- `goal launcher:` `tickets/TASK-0052/goal.md`
- `artifacts:` `tickets/TASK-0052/artifacts/`
- `review:` pending
- `refs:` `tickets/TASK-0052/design.md`, `docs/TASTE.md`

## Notes

- Full implementation autonomy is granted inside this ticket's local code,
  tests, screenshots, and skill-memory scope.
- Approval provenance: the operator wrote “okay i give you full control, just
  show me your results each time and i give feedback and you update the skill”
  in the current Codex task before this packet was compiled.
- Goal rerun provenance: the operator then wrote “use a goal-advisor to modify
  the office until its kinda like this sample” and “dont disturb me until you
  reach A,” explicitly approving uninterrupted local Goal execution.
- Show a real app screenshot every cycle; do not present compile success as
  aesthetic evidence.
