---
template_id: ticket-template
template_version: "0.1.3"
ticket_id: TASK-0039
title: Refine evidence-backed UI content composition
phase: proof
status: review
owner: codex
claimed_by:
priority: medium
depends_on: []
blocked_by: []
ready: true
approval_required: false
requires_qa: false
requires_demo: false
created_at: 2026-07-12T00:00:00+08:00
updated_at: 2026-07-12T06:28:13+08:00
next_action: review packet contract and dry example; worker released by Work Pulse
last_verification: "2026-07-12 Work Pulse reconciled worker 019f5331-a2c8-7841-af8a-eff29a6e1c74 output: packet contract and TASK-0020 dry example written; no publish/deploy/spend/account/customer/external action taken"
---

# TASK-0039: Refine Evidence-Backed UI Content Composition

## Summary

Farplane UI's content product is now part of the 1.9.1 harness, but the
recurring composition from accepted UI evidence into content/storyboard/social
or video artifacts still needs one project-local refinement pass. Do not add a
content heartbeat, product controller, or state system.

## Scope

- In: a minimal reusable packet or local skill shape for composing accepted UI
  evidence through `content-impl-plan`, `storyboard`, `social-content`,
  `video-production`, `remotion`, `x-account`, `instagram-account`, and `qa`.
- Out: publishing, account mutation, spend, customer contact, deploys, new
  scheduler/heartbeat, or new runtime state system.

## Delta

```text
before:
  - content/demo work is allowed but not packaged as a repeatable
    evidence-to-content composition.
after:
  - one minimal project-local content composition contract exists, with
    accepted UI evidence as a required input and approval gates preserved.
```

## Program

1. Inventory recent accepted UI proof artifacts and content/demo tickets.
2. Define the smallest packet shape:
   accepted evidence refs, claim, target audience, platform, asset route,
   QA/review proof, approval gates, and response observations.
3. Decide whether the workflow is stable enough for
   `.agents/skills/evidence-backed-ui-content/SKILL.md`; otherwise keep it as
   a ticket-owned refinement artifact.
4. Run one dry example against an existing accepted UI workflow without
   publishing.

## Done / Proof

- [x] The packet requires accepted UI evidence before content work can count
      toward the content product.
- [x] Root skills are reused instead of copied.
- [x] Publishing, deploys, account mutation, spend, and customer contact are
      approval-gated.
- [x] No new heartbeat, controller, or durable runtime state system is added.
- [x] One dry example is reviewable from ticket evidence.

## Links

- `farplane/harness.yaml`
- `farplane/bindings.yaml#content`
- `progress:` `tickets/TASK-0039/progress.md`
- `artifacts:`
  - `tickets/TASK-0039/artifacts/evidence-backed-ui-content-packet.md`
  - `tickets/TASK-0039/artifacts/dry-example-task-0020-thread-data.md`
- `dry_example_source:` `tickets/TASK-0020/ticket.md`
