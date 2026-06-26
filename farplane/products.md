---
kind: project-products
status: active
project: Farplane UI
created_at: 2026-06-26
updated_at: 2026-06-26
framework_template_version: "0.2.0"
owner: harness
source_of_truth:
  - farplane/harness.md
  - farplane/goals.md
  - docs/prd.md
  - docs/specs/FP02-harness-product-model.md
---

# Farplane UI Products

## Team

| Field | Value |
| --- | --- |
| Archetype | founder_control_ai_office |
| Core product | playful local office cockpit that makes agents intuitive and fun to use |
| Secondary product | viral demos and feature showcases that help people understand and want Farplane |

## Products

| ID | Product | Audience | Output | Reward |
| --- | --- | --- | --- | --- |
| viral_agent_office | Viral agent-office experience | potential Farplane users, builders, operators, demo viewers | tasteful Sims/entrepreneur-simulator-like office scenes, agent characters, decoration, progress moments, shareable demos | views, qualified curiosity, saves/shares/replies, people asking how to try it |
| feature_showcases | Farplane feature showcases | builders trying to understand Farplane's harness power | intuitive UI for skills, evals, research, tickets, goals, runtime state, and proof | viewers/users understand one Farplane feature and why it matters |
| office_cockpit | Founder-control office | founder-operators running local AI work | `/office`, module shell, team/project views, command surfaces | operator can see current work and take the next action quickly |
| pm_orchestration | PM operating loop | founder-operators and PM automation threads | Pulse, Daily Interval, Weekly Interval, ticket selection, split/refill/content proposals | one bounded useful action, split, refill, content, or approval request per beat with evidence |
| runtime_visibility | Runtime visibility surfaces | operators and reviewers | Codex/OpenClaw adapters, status panels, thread/team/project read models | long-running agents are monitorable with clear provenance, freshness, and failure states |
| board_review_loop | Ticket and review workflow | operators coordinating agent work | board, review lane, ticket memory, proof links, QA affordances | work moves from idea to ticket to reviewed artifact without transcript archaeology |
| harness_modules | Harness operating modules | Farplane maintainers and project operators | Harness Map, Skill OS, Eval OS, rollout, QA, settings, and related modules | reusable harness work becomes discoverable and operable from the UI |
| proof_surfaces | Browser QA and evidence flows | operators, reviewers, and future agents | QA cookbook paths, probes, screenshots, tests, and evidence notes | UI claims are backed by repeatable proof before closeout |

## Work Lanes

| Lane | Default Weight | Purpose |
| --- | ---: | --- |
| viral_agent_office | 25 | make agents feel fun, tasteful, characterful, and shareable |
| feature_showcases | 20 | turn Farplane framework features into intuitive, functional UI |
| office_workflows | 20 | improve the main founder-control office experience |
| pm_orchestration | 15 | keep the PM loop focused on one useful action, split, refill, content, or approval decision |
| runtime_adapters | 10 | make Codex/OpenClaw/project state visible, accurate, and inspectable |
| proof_and_quality | 10 | prove UI behavior, reduce regressions, and strengthen review paths |
| harness_modules | 10 | expose reusable Farplane harness capabilities in the app |
| product_learning | 5 | sharpen user workflows, positioning, and adoption signals |
| maintenance | 5 | keep the repo, tickets, docs, and local runtime operable |

## Shared Metrics Boundary

| Funnel Stage | Primary Owner | Farplane UI Role | Farplane Core Role |
| --- | --- | --- | --- |
| Views and attention | Farplane UI | Create shareable demos, scenes, UI moments, landing hooks, and content tickets. | Supply proof-backed claims and real harness wins. |
| Qualified curiosity | Shared | Convert views into replies, saves, stars, site clicks, access requests, and "how do I use this?" questions. | Convert curiosity into credible harness explanation and next steps. |
| Try intent | Shared | Make the product understandable and desirable enough that people want to run it. | Own clone/install/onboarding path and first harness loop. |
| Clone/install | Farplane Core | Link users clearly to the right next step; avoid owning downstream install metrics as the UI's primary score. | Own clone, install, first measured loop, and framework adoption. |
| Retention/churn | Later shared phase | Instrument UI activation and repeat use when there is enough traffic. | Own retained harness use and evidence-improving loops. |

## PM Planning Rule

Pulse and interval planning should use these product rows and work-lane weights
as the default refill/bandit surface. New PM-generated tickets must name:

- product row
- baseline or comparison point
- expected artifact
- proof or feedback signal
- owner boundary when the ticket crosses into Farplane core

## Constraints

- Products are not chores.
- Pulse executes tickets; intervals create, split, reprioritize, or request
  product-shaped tickets.
- Farplane UI may create both product/UI tickets and distribution/content
  tickets when they serve the viral agent-office or feature-showcase products.
- Farplane UI should not treat clone/install/first-harness-loop metrics as its
  primary owned score; those are downstream Farplane core metrics.
- Operational planning, refill, and prioritization logic belongs in
  `interval-update`, not this file.
