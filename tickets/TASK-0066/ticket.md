---
template_id: ticket-template
template_version: "0.1.3"
ticket_id: TASK-0066
title: Farplane YouTube shortcut extension
phase: closeout
status: done
owner: codex
claimed_by: codex-local
priority: medium
depends_on: []
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-07-22T04:00:00+08:00
updated_at: 2026-07-22T22:30:00+08:00
next_action: archive when this repo provides rules/validation.toml for the canonical close command
last_verification: 2026-07-22 11 focused tests, isolated-app typecheck/build, live Farplane-theme browser proof, and real Analyst-routed Codex task passed
---

# TASK-0066: Farplane YouTube shortcut extension

## Summary

Move the proven YouTube summary shortcut out of Cura and into a dedicated
Farplane-owned Plasmo workspace. Preserve Cura and its Convex product, keep the
cache-first persistent Codex-task flow, and replace the large rectangular
control with a thumbnail-owned corner Analyze action that toggles a ready
summary without activating YouTube's hover preview.

## Scope

- In: `apps/youtube-shortcut`, Farplane workspace registration, local Codex
  bridge, schema-versioned cache, optional `~/.farplane/USER.md`, corner action,
  ready-panel toggle, scroll/lazy-hydration handling, tests, Brave
  loading instructions.
- Out: Cura cleanup/reset, Cura web or Convex changes, hosted deployment,
  automatic Chrome Web Store publishing.

## Delta

```text
overall_before:
  - Farplane's YouTube shortcut exists only as uncommitted changes in a Cura clone.
  - The thumbnail control is a large rectangular Quick answer button.
overall_after:
  - Farplane owns a standalone Plasmo workspace with no Cura/Convex imports.
  - A thumbnail-owned corner action runs analysis once, then toggles the cached panel.
first_principles_basis:
  objective: answer video-title claims without opening the video
  need: low-friction, Farplane-owned, inspectable Codex tasks
  assumptions: local Codex app-server and summarize skill remain available
  root_cause: prototype ownership and interaction design do not match the product
  constraints: preserve the dirty Farplane worktree and do not mutate Cura
  first_viable_slice: Brave-loadable MV3 build with live YouTube proof
  proof_or_falsification: cache/job tests plus scroll and toggle browser QA
  tradeoff: add one isolated workspace to the Farplane monorepo
  non_goals: reuse Cura's hosted Convex ingestion or web application
```

## Change Plan

### Change 1: Isolate product ownership

```text
fixes:
  - The shortcut currently appears to belong to Cura.
before:
  - Prototype code lives under Cura apps/extension and root scripts.
after:
  - Farplane apps/youtube-shortcut owns all extension and bridge code.
write:
  - path: apps/youtube-shortcut
    change: add standalone Plasmo workspace and local bridge
  - path: pnpm-workspace.yaml
    change: register the new workspace
operation:
  - migrate only the proven local implementation; remove Cura/Convex coupling
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - install, typecheck, and production-build the isolated workspace
failure_modes:
  - accidental edits to Cura or unrelated dirty Farplane files
```

### Change 2: Compact toggle interaction

```text
fixes:
  - The current button is visually heavy and the panel interaction is not toggled from one control.
before:
  - Rectangular Quick answer button; summary panel owns dismissal.
after:
  - Flush corner Analyze action with idle/loading/ready/error states.
  - First uncached click analyzes; ready clicks toggle the panel open and closed.
signature_or_type_impact:
  - UI state separates analysis readiness from panel visibility.
routes:
  docs: update_docs
  qa: visual-qa
  review: reviewer
qa:
  - keyboard labels, aria-expanded, cache hit, panel toggle, scroll hydration
failure_modes:
  - button navigates the thumbnail, duplicate mounts, or cache hit starts a new task
```

## Done

```text
done_when:
  - Cura has no new changes from this migration.
  - Farplane produces a Brave-loadable Chrome MV3 build.
  - Cache misses create persistent Codex tasks; hits reuse analysis and thread ID.
  - The thumbnail corner action has an accessible label and toggles ready content.
  - Lazy-loaded YouTube cards retain exactly one button each.
  - Focused tests, typechecks, build, browser QA, and independent review pass.
```

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa
  checks:
    - cache hit/miss contract tests
    - local bridge protocol tests
    - extension typecheck and production build
  manual:
    - load unpacked build, scroll through lazy-loaded results, analyze, close, and reopen
  delegated_lanes:
    - independent implementation review after proof
  review:
    - rubric: implementation and evidence
      required_tas: TAS-A
  evidence:
    - record compact observations in this ticket
  residual_risk:
    - YouTube DOM renderer changes require selector maintenance
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - apps/youtube-shortcut/README.md
  validation:
    - instructions point Brave to the generated MV3 folder
```

## Agent Contract

- Open: build the workspace, then load `build/chrome-mv3-prod` through
  `brave://extensions`.
- Inspect: accessible button labels, `aria-expanded`, panel text,
  console errors, and DOM button counts after scrolling.
- Key states: idle, loading, ready-collapsed, ready-expanded, cached, error.
- QA cookbook: `qa/README.md` plus live YouTube browser proof.

## Links

- `program:` none
- `progress:` none
- `artifacts:` none
- `review:` TAS-A pass; no blocking findings
- `refs:` official Plasmo content-script/background/storage documentation

## Notes

- The Cura clone remains a read-only migration source until this ticket passes.
- Root Farplane manifests and lockfiles were already dirty; preserve unrelated
  edits and keep shared changes narrowly scoped.
- `contents/youtube.tsx` intentionally keeps mount lifecycle and rendered state
  together for this first slice despite exceeding 500 lines. Split the summary
  panel after live proof if the component receives another responsibility.
- `popup.tsx` intentionally keeps its two-tab operator surface and local styles
  together for this first slice despite exceeding 500 lines. Split Jobs and
  Status into module-local components before adding another top-level tab.
- `scripts/local-agent.ts` intentionally keeps the one-purpose Codex RPC and
  localhost bridge lifecycle together despite exceeding 500 lines. Split the
  RPC client from the HTTP job adapter before adding another analysis route.
- Production proof created persistent Codex thread
  `019f864f-df18-7f51-b8b3-6970ee80338f`; a reload reused its cache and thread.
- Browser QA: controls increased from 19 to 31 after lazy scrolling, duplicate
  targets remained zero, and close/reopen/Escape/focus-tooltip states passed.
- Diagnostics popup proof shows the bridge, existing Codex app-server, and
  summarize skill healthy. Health uses POST so the browser supplies the exact
  extension Origin required by the bridge.
- Chrome match patterns cannot scope host permissions to a single port; the
  manifest therefore uses the documented `http://127.0.0.1/*` IP pattern while
  the server exposes only ports/routes it owns and enforces the extension Origin.
- Workspace-wide UI typecheck is not claimed by this ticket and currently has
  unrelated pre-existing failures. This ticket's isolated app typecheck passes.
- Root dependency removals, global script changes, package-lock churn, and most
  pnpm-lock churn predated this ticket. Ticket-attributable root changes are the
  app workspace entry, YouTube scripts, and lockfile importer only.
- Evidence report:
  `docs/research/qa-testing/TASK-0066/2026-07-22_youtube-shortcut/report.md`.
- Independent completion re-review: TAS-A, pass, no blocking findings. The
  workspace-wide UI typecheck remains unrelated dirty-worktree debt.
- Canonical ticket validation could not run because this repo currently lacks
  `rules/validation.toml`; implementation is done, but archival is deferred
  rather than bypassing the close command.
- Correction proof: `TRANSCRIPT_UNAVAILABLE` is now a hard failure, legacy
  cached failure-cards are invalidated, no new failure is cached, and the error
  panel preserves the failed Codex task link. Browser evidence:
  `screens/summarize-failure.png`; focused suite passes 9/9.
- Narrow correction re-review: TAS-A, pass, no blocking findings.
- Popup redesign replaced the stale Cura-style diagnostics layout with compact
  Farplane offline and ready states. Final evidence is 348 px wide with no
  horizontal overflow: `popup-redesign-offline-final.png` and
  `popup-redesign-ready.png`.
- Popup redesign independent review: TAS-A, pass, no blocking findings.
- Theme correction: replaced the generic amber/red rounded popup skin with the
  canonical Farplane dark tokens, JetBrains Mono typography, sharp geometry,
  restrained state edges, and zero decorative shadow. Real unpacked-extension
  proof covers offline/copy feedback and ready/keyboard-focus states:
  `popup-farplane-theme-offline.png` and `popup-farplane-theme-ready.png`.
- Theme correction independent review: TAS-A, pass, no blocking findings. The
  review's setup-incomplete accent note was resolved by using copper until all
  required runtime services are ready.
- Thumbnail hit-test correction: the control no longer mounts inside YouTube's
  full-thumbnail anchor. Live MV3 proof shows 12 initial and 20 post-scroll
  controls, zero anchor-nested hosts, successful first/new-card clicks, and no
  YouTube navigation. Evidence: `thumbnail-button-hit-test.png` and
  `tickets/TASK-0066/artifacts/qa/2026-07-22-thumbnail-hit-test/qa.md`.
- Thumbnail hit-test correction independent review: TAS-A, pass, no blocking
  findings.
- Hover-preview correction: YouTube's moving preview is a global layer outside
  each video card, so card-level z-index could not own the hit target. Control
  hosts now use a document-level fixed portal while React state stays bound to
  the card. Live Brave proof shows the control visible, pinned, topmost, and
  clickable during preview hover with no navigation; detached/offscreen cards
  are cleaned or hidden. Evidence: `global-portal-live-hover.png` and the
  updated thumbnail hit-test QA report.
- Hover-preview/global-portal independent review: TAS-A, pass, no blocking
  findings.
- Job observability correction: the local bridge now retains the 20 most
  recent queued/running/succeeded/failed jobs in memory, publishes them to the
  popup, and exposes a `codex://threads/<id>` link as soon as the persistent
  task exists. No additional personal sidecar file was introduced.
- Failure `019f880e-5722-7570-91d8-97924ee649de` was caused by the bridge's
  read-only turn sandbox blocking summarize's SQLite/cache writes (`unable to
  open database file`, then `EPERM` under `/tmp/.summarize`). The turn now uses
  app-server `workspaceWrite` policy with `~/.summarize` as the sole additional
  writable root so the complete installed skill can use its normal local cache
  and transcript tooling without broad filesystem write access.
- Final narrow-policy replay created task `019f8817-e112-7ec0-ad79-0ace81f294e3`. It passed
  the former database failure and reached YouTube extraction, then honestly
  failed because only a short description—not a usable transcript—was
  available. Popup running/failed evidence and the task href are recorded in
  `tickets/TASK-0066/artifacts/qa/2026-07-22-job-queue/`.
- Job queue and sandbox correction independent review: TAS-A, pass, no
  blocking findings. Reviewer confirmed the narrow writable-root boundary,
  truthful lifecycle states, and evidence-backed Codex deep links.
- Popup hierarchy correction: Jobs is now the default top-level tab and Status
  owns runtime diagnostics/setup. Tabs use semantic ARIA relationships,
  roving tab focus, click and Left/Right Arrow navigation, while job links and
  live polling remain unchanged. Browser proof at 348 px shows zero horizontal
  overflow in both tabs: `popup-jobs-tab.png` and `popup-status-tab.png`.
- Popup tab hierarchy independent review: TAS-A, pass, no blocking findings.
- Scroll-anchor correction: current Brave/Chromium uses native CSS Anchor
  Positioning to bind each document-level portal control to its thumbnail; an
  animation-frame positioner remains for older Chromium. Controls hide at the
  live YouTube masthead/chip boundary instead of clamping into the sticky
  header. Live proof recorded zero top/right anchor error after scroll, an
  active hover preview with the Farplane host winning the pointer hit test, and
  20 unique post-scroll hosts with zero duplicates. Evidence:
  `tickets/TASK-0066/artifacts/qa/2026-07-22-anchor-sync/qa.md`.
- Scroll-anchor correction independent review: TAS-A, pass, no blocking
  findings. Reviewer confirmed feature-gated native anchoring, rAF fallback,
  anchor-name cleanup on detach/rebind, batched layout reads, pointer ownership,
  and sufficient live evidence.
- Corner-action correction supersedes the fixed-portal/anchor approach. The
  control now mounts directly under Cura's proven `ytd-thumbnail`, `#thumbnail`,
  and `.yt-lockup-view-model__content-image` ownership boundary, with
  `ytd-thumbnail` preferred so the action remains outside the video link. Live
  proof shows 20 controls, zero anchor-nested hosts, zero duplicate parents,
  and preview suppression scoped only to control hover. Evidence:
  `tickets/TASK-0066/artifacts/qa/2026-07-22-corner-action/qa.md`.
- Repeated summarize failures were traced across jobs 1-3 to unavailable
  captions, not the bridge or SQLite: the installed CLI and current 0.21.6 both
  returned `transcriptSource=unavailable`; direct yt-dlp found automatic
  captions but YouTube returned HTTP 429, and no audio transcriber/API fallback
  is configured. The bridge prompt now accepts substantive page-owned
  description/chapters/quotes as explicitly limited `SUMMARY_ONLY` evidence,
  while thin or missing material remains a hard failure. Real replay task
  `019f8856-f822-71c2-a753-9aff84574d7e` succeeded with `SUMMARY_ONLY`.
- Corner-action initial review found that fallback lockup classes could
  themselves be watch anchors. The owner resolver now climbs completely outside
  any `/watch?v=` anchor, and a live synthetic lockup probe confirmed the host
  mounts on the outer card with no link containment. The preview guard install
  is also idempotent for content-script re-entry.
- Corner-action and source-policy re-review: TAS-A, pass, no blocking findings.
  Reviewer confirmed the fallback anchor blocker is resolved and the live
  synthetic lockup proof covers the exact supported fallback shape.
- Stacking containment correction: removed the control host's page-level
  `z-index: 2147483000`, isolated the owning thumbnail stacking context, and
  retained only local `z-index: 3`. Live scrolled-browser proof shows YouTube's
  fixed chrome wins the hit test where it covers the thumbnail, while Analyze
  remains visible on the exposed thumbnail region. Evidence:
  `tickets/TASK-0066/artifacts/qa/2026-07-22-corner-action/analyze-stacking-contained.png`.
- Recommendation alignment correction: current YouTube watch-page lockups use
  `.ytLockupViewModelContentImage`, not only Cura's legacy
  `.yt-lockup-view-model__content-image`. The mount resolver now supports both
  and measures thumbnail-relative offsets inside the nearest safe non-link
  owner. Eight recommendation and eight search-result samples recorded zero
  top/right error with no control nested in a watch link. Evidence:
  `tickets/TASK-0066/artifacts/qa/2026-07-22-corner-action/recommendation-thumbnail-alignment.png`.
- Thumbnail theme correction: replaced the remaining amber, rounded, shadowed
  content-script skin with the canonical Farplane dark OKLCH tokens,
  JetBrains Mono, zero-radius geometry, and zero decorative shadow. Live proof
  includes idle, scrolled, and expanded cached-answer states in
  `tickets/TASK-0066/artifacts/qa/2026-07-22-corner-action/`.
- Analyst routing correction: new extension-created Codex tasks now start with
  `/Users/kenjipcx/Zanarkand Technologies/Analyst` as `cwd`, which is the root
  of registered Codex project `82e14ae3-dbcf-47d2-905f-17b3f7ac456c`.
  Fresh task `019f8a38-5fee-7b40-aff0-4539fe09ae55` persisted that exact cwd.
