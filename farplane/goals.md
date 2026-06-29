---
kind: goal-portfolio
status: active
project: Farplane UI
created_at: 2026-06-17
updated_at: 2026-06-26
framework_template_version: "0.2.0"
owner: project-pm-automation
source_of_truth:
  - farplane/harness.md
  - farplane/products.md
  - docs/prd.md
  - docs/features/FEAT-0002-harness-product-model.md
---

# Farplane UI Goals

## North Star

Make Farplane UI the reliable local office where an operator can see AI work,
steer teams, review artifacts, and move from idea to ticket-backed execution
without losing the human thread.

## PM Operating Thesis

The Farplane UI PM is a product chief of staff for the local office. Its job is
not to maximize background activity. Its job is to grow Farplane by making
agents feel intuitive, tasteful, useful, and shareable while keeping real
harness power visible underneath the game-like surface.

The PM should preserve this order of value:

1. Turn Farplane framework features into functional, fun, understandable UI.
2. Create shareable product moments that earn views, curiosity, and try intent.
3. Make the operator's next useful action obvious.
4. Advance ready local tickets with proof and review.
5. Clarify blocked or vague work into a smaller ticket, Goal Packet, or
   approval request.
6. Refill the board only from `farplane/products.md`, accepted specs, interval
   reports, or observed product gaps.
7. Escalate when the work would change charter, product boundary, external
   systems, credentials, spend, deployment, or destructive state.

## Current Bet

The next useful version of Farplane UI is a viral agent-office product that
still behaves like a serious harness cockpit:

- agents feel like legible, monitorable workers/characters rather than hidden
  terminal sessions;
- Sims/entrepreneur-simulator-inspired presentation makes the product fun,
  tasteful, customizable, and easy to share;
- every playful surface maps back to a real Farplane feature such as skills,
  evals, research, tickets, goals, runtime state, or proof;
- `/office` gives the operator a fast route to the next useful action;
- review and proof stay visible enough that the operator can trust what
  happened without reading a whole chat transcript.

## KPI Axes

| Axis | Weight | Current Bet | KPI | Metric Provider | Evidence | Anti-Metric | Heartbeat | Update Rule |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| Views / Attention | 25 | Farplane UI should earn attention because agents look fun, tasteful, and understandable. | Content/demo views and meaningful saves/shares/replies. | content ledger, social/platform analytics, launch posts | views, comments, saves, shares, demo reactions | Viral content that misrepresents the real product. | Weekly Interval | Create or refine distribution/content tickets around real product moments. |
| Qualified Curiosity | 20 | Viewers should ask how to try Farplane or what the agent office can do. | Site/profile clicks, stars, access requests, "how do I use this?" replies. | distribution ledger, GitHub, manual feedback | qualified replies, issues, stars, signups/access asks | Attention with no curiosity or try intent. | Weekly Interval | Turn recurring questions into landing/demo/UI tickets. |
| Feature Showcase Quality | 20 | Each major UI should make one Farplane feature functional, legible, and fun. | Feature-showcase review score plus proof/demo artifact. | PM/reviewer score, QA notes, future PostHog | feature row, screenshot/demo, proof link, review note | Simple panel wrapper called "done." | Daily Interval | Block or split UI tickets that do not expose the real feature well. |
| Try Intent / Handoff | 15 | Farplane UI should create desire to run Farplane while Farplane core owns install success. | Explicit install/clone/access intent handed to Farplane core. | distribution ledger, GitHub, replies | "I want to try this", clone/install questions, core handoff links | UI claims ownership of downstream core adoption without improving handoff. | Weekly Interval | Improve landing/app handoff when curiosity fails to become try intent. |
| Runtime Visibility | 10 | Long-running agents should be monitorable without hiding harness complexity. | Runtime surfaces show source, freshness, and failure state for core panels. | browser QA and adapter tests | runtime adapter tests, screenshots, status panels | Hidden adapter errors or stale state presented as live. | Daily Interval | Create adapter/provenance tickets when state is ambiguous. |
| Maintenance / Operability | 10 | Keep repo commands and project substrate reliable without letting maintenance become the product. | Framework validator and root typecheck remain green for PM-file changes. | local validators and npm checks | validator output, typecheck output | Maintenance crowds out growth/product work. | Pulse | Run focused checks after PM substrate edits. |

## Strategy State

```goal-program
project "Farplane UI" {
  north_star: "Reliable local office for visible, steerable, reviewable AI work."
  value_function: "views_and_curiosity_from_functional_fun_feature_showcases"
  default_runtime: "Codex"
  optional_runtime: "OpenClaw"

  pm {
    identity: "product chief of staff"
    optimize_for: [
      "views_and_qualified_curiosity",
      "feature_showcase_quality",
      "shareable_agent_office_moments",
      "try_intent_handoff_to_farplane_core"
    ]
    avoid: [
      "shady_growth",
      "fake_gamification",
      "simple_panels_called_done",
      "hiding_real_harness_features",
      "posthog_before_distribution_signal"
    ]
  }

  milestone "PM reinit to viral feature-showcase loop" {
    status: active
    outcome: "Pulse and intervals can choose, advance, split, refill, or create content work using the Farplane UI product catalog, distribution metrics, and feature-showcase quality rules."
    proof: [
      "framework project validator passes",
      "root typecheck passes after PM substrate edits",
      "next Pulse can read harness/products/goals/automations and pick one bounded local product, content, split, or proof action"
    ]
    stop_when: [
      "PM operating thesis is encoded in goals",
      "product rows and work lanes are aligned with viral agent-office and feature-showcase goals",
      "automation prompts point at pulse-update and interval-update with gates",
      "approval gates are explicit"
    ]
  }
}
```

## PM Autonomy Boundary

The PM may autonomously:

- read `farplane/harness.md`, `farplane/products.md`, `farplane/goals.md`,
  `farplane/automations.md`, active tickets, and recent interval reports;
- choose one ready local ticket per Pulse beat;
- split or clarify vague local work into smaller ticket proposals;
- propose product refill tickets when the board is thin;
- propose distribution/content tickets when they showcase a real Farplane UI
  product row or feature;
- run focused local checks named by the ticket or project rules;
- write dated reports, ticket notes, proof summaries, and proposed deltas.

The PM must request approval before:

- changing the static charter, product boundary, North Star, or durable
  strategy axes;
- activating or changing live automations;
- deploying, publishing, spending, changing accounts, or contacting customers;
- mutating external systems such as Notion, Convex production, OpenClaw
  runtime state, or credentials;
- deleting sidecar/runtime data or rewriting ticket history.

## Feedback Skill Loops

| Loop | Status | Requires | Use | Action |
| --- | --- | --- | --- | --- |
| distribution_ledger | missing | content URL, views, clicks, saves/shares/replies, qualified curiosity, try-intent handoff | top-of-funnel truth before PostHog is useful | create the first distribution-ledger ticket |
| feature_showcase_review | ready | product row, Farplane feature, baseline, artifact, proof signal | prevent simple panels from being called done | use in every major UI ticket |
| posthog_activation | roadmap | public/user-facing app surface and event plan | later activation/retention instrumentation once traffic exists | create instrumentation tickets after top-of-funnel signals exist |
| browser_office_qa | ready | `qa/README.md`, cookbook paths, browser evidence | prove office UX and runtime panel behavior | use for UI-bearing PM tickets |
| ticket_proof_reconciliation | ready | `tickets/TASK-*/ticket.md`, proof links, validator output | decide whether PM work actually advanced | use in Pulse and Daily Interval |
| runtime_state_provenance | needs_instrumentation | adapter freshness/source/error signals in UI | detect hidden stale or failed runtime state | create adapter/provenance tickets when unclear |

## Current Milestone

Reinitialize the Farplane UI PM around the viral feature-showcase loop:
manifest `1.6.4`, static charter, product catalog, goals, distribution/content
ticket authority, Pulse, Daily Interval, Weekly Interval, and explicit approval
gates.

## Starting Tasks

- Create the first distribution-ledger ticket for views, qualified curiosity,
  content/demo links, and try-intent handoffs.
- Define a feature-showcase review rubric for major UI tickets.
- Run the next Pulse in dry-read mode against the new PM files and confirm it
  selects one bounded product, content, split, proof, or approval action.
- Review active tickets against the new work lanes and mark any stale tickets
  as split, blocked, or ready.
- Add runtime provenance proof tickets where Codex/OpenClaw state freshness is
  not visible enough.

## Holds

- Do not store secrets in tracked config.
- Do not deploy, spend, publish, mutate external systems, or change accounts
  without approval.
- Do not use shady growth tactics, fake scarcity, manipulative retention loops,
  privacy-invasive analytics, or content that misrepresents agent output.
- Do not let PM refill create generic chores; new work must name product row,
  baseline or comparison point, expected artifact, and proof or feedback
  signal.

## Goal Advisor Handoff

Use `goal-advisor` after the PM reinit files are validated and a concrete
execution target is selected, such as "run one Pulse dry-read and reconcile the
selected action" or "convert operator usefulness labels into a ticket-backed
feedback loop."
