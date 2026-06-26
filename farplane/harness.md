---
kind: project-harness
status: active
project: Farplane UI
created_at: 2026-06-17
updated_at: 2026-06-26
framework_template_version: "0.3.0"
owner: harness
---

# Farplane UI Harness

## Mission

Build the local founder-control office for AI work: a compact, inspectable
cockpit where an operator can see teams, steer runtime-backed agents, review
artifacts, and move ideas into ticket-backed execution.

## Human Thesis

Farplane UI should preserve the operator's judgment while making autonomous
work easier to trust. The office exists to keep AI work visible, interruptible,
reviewable, and grounded in files rather than hidden runtime state.

## Operating Principles

- Prefer visible project artifacts over transcript memory.
- Keep runtime state inspectable and adapter-backed.
- Make Codex the default local office runtime and keep OpenClaw optional.
- Shape material work through tickets, specs, or Goal Packets before broad
  implementation.
- Prove UI-bearing changes with browser evidence, tests, or reviewer output
  before closeout.

## Static Leverage Commitments

| Commitment | Why It Compounds | Evidence To Seek | Pivot Signal |
| --- | --- | --- | --- |
| Founder-control office | A reliable operator cockpit makes every downstream agent workflow easier to steer and review. | Operators can enter `/office`, understand current work, and take the next action without reading chat history. | The office becomes decorative or slower than direct file/CLI work. |
| Runtime visibility | Adapter-backed runtime state turns opaque sessions into inspectable teams and artifacts. | Codex/OpenClaw state appears in stable modules with clear loading, failure, and provenance states. | Runtime panels create false confidence or hide source uncertainty. |
| Proof-first UI work | Browser evidence and focused checks prevent polished-looking regressions. | UI tickets include screenshots, QA notes, or automated checks that change closeout decisions. | Proof artifacts become busywork and do not catch regressions. |

## Non-Tradeoffs

- Do not store secrets in tracked config.
- Do not hide automation, runtime, or ticket state outside visible files or
  ignored `.farplane/` ledgers.
- Do not silently change the durable product boundary from local office cockpit
  to hosted control plane or generic SaaS.
- Do not make OpenClaw required for workflows that should work through the
  default Codex adapter.

## Allocation Guardrails

| Guardrail | Rule |
| --- | --- |
| Product focus | Prioritize office workflows that help the operator see, steer, review, or prove AI work. |
| Runtime adapters | Keep adapter-specific behavior behind explicit runtime boundaries and settings. |
| QA | UI-bearing tickets need browser evidence or an explicit reason it is not useful. |
| Maintenance | Maintenance should unblock product trust, runtime clarity, or ticket execution rather than becoming the main product. |
| Authority | Deploys, external mutation, credentials, account changes, spend, destructive cleanup, and public product-boundary shifts require explicit authorization unless already granted by ticket or policy. |

## Agent Authority

- Agents may update product rows, goals, tickets, docs, and QA surfaces through
  evidence-backed deltas.
- Agents may propose static charter changes when new evidence shows this
  harness is steering the wrong product.
- Agents may not silently rewrite the human thesis, non-tradeoffs, product
  boundary, or authority model.

## Change Rule

Static charter changes require an explicit human-approved harness delta.
