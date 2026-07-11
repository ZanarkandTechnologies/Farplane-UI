---
name: farplane-ui-product-ops
description: "Turn accepted Farplane UI evidence into product-cycle, content, and adoption-learning artifacts without creating a new controller."
tier: 3
group: project
source: project-local
owner: harness
template_uses:
  skill-template: "0.3.2"
---

# Farplane UI Product Ops

## Context

Use this project-local capability when a Farplane UI ticket, Pulse refill, or
interval report needs to turn accepted UI evidence into one of the selected
descriptive products in `farplane/harness.yaml`:

- accepted founder-control UI workflows/releases;
- evidence-backed UI demos and content;
- adoption or market learning briefs that change product or distribution
  decisions.

This skill is not a heartbeat, scheduler, product controller, or publishing
surface. It composes existing root skills and ticket proof. Publishing,
deploys, account mutation, spend, customer contact, and destructive cleanup
remain approval-gated.

## Skill Signature

```text
farplane_ui_product_ops(evidence_ref, product_id, artifact_goal, channel?, approval_state?)
  -> product_cycle_packet
   + root_skill_route
   + proof_refs
   + source_gaps
   + approval_gate
```

## Todo List

- [ ] 1. Bind the product and evidence.
  - [ ] Confirm `product_id` is one of the products in `farplane/harness.yaml`.
  - [ ] Require accepted UI evidence before counting a product cycle.
  - [ ] Name ticket refs, QA/review refs, screenshots/demos, and residual risk.
- [ ] 2. Route through existing skills.
  - [ ] UI workflow/release: use `frontend-craft`, `visual-qa`, `qa`, and
        `review` as needed.
  - [ ] Evidence-backed content: use `content-impl-plan`, `storyboard`,
        `social-content`, `video-production`, `remotion`, and platform skills
        such as `x-account` or `instagram-account` only up to approval gates.
  - [ ] Adoption learning: use `customer-research`, `feed-scout`, `research`,
        or `update-strategy` when source-backed decisions are needed.
- [ ] 3. Preserve gates.
  - [ ] Treat publish, deploy, spend, account mutation, customer contact, and
        destructive cleanup as approval-required.
  - [ ] Record unavailable analytics, platform access, or install-interest
        capture as source gaps instead of planner objectives.
- [ ] 4. Write the product-cycle packet.
  - [ ] Include `product_id`, `evidence_ref`, `artifact_goal`,
        `root_skill_route`, `proof_refs`, `metric_refs`, and `approval_gate`.
  - [ ] Link `TASK-0039` until the content composition packet is proven by a
        dry example.

## Output

Return a compact packet suitable for a ticket note, Pulse decision, or interval
report. Do not publish, deploy, mutate accounts, spend, or contact customers.

## Proof

Validator proof: `python3 /Users/kenjipcx/Zanarkand\ Technologies/projects/Farplane/bin/validators/check_farplane_project_files.py --root .`
