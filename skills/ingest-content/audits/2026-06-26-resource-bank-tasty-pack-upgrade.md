---
skill: ingest-content
date: 2026-06-26
change_type: behavior
owner: skill-maintenance
status: pass
review_route: self_check
before_ref: /Users/kenjipcx/.codex/skills/ingest-content/SKILL.md
after_ref: /Users/kenjipcx/.codex/skills/ingest-content/SKILL.md
reasoning_basis: first_principles
proof_artifacts:
  - /Users/kenjipcx/.codex/skills/ingest-content/references/resource-bank-contract.md
eval_required: no
---

# Skill Audit

## Change

- Before: `ingest-content` wrote against the older LocalPinterest content-item
  contract and treated retrieval mostly as tags plus future reusable elements.
- After: `ingest-content` writes against Farplane Resource Bank, fills
  Tasty Pack retrieval facets on primary assets, and stores hook/retention
  mechanics in analysis text rather than a managed performance-tag taxonomy.
  Post-QA also removed stale content-item wording and shortened the first-load
  example into a Resource Bank-shaped packet.
- Why: The Resource Bank product now retrieves saved taste by timeframe,
  audience, industry, customer role, output type, project, and idea. The skill
  must populate those fields during ingestion.
- Tradeoff accepted: The installed skill is updated directly because the
  operator explicitly requested it; no repo-owned `skills/ingest-content`
  package exists in the current Farplane checkout to edit as source of truth.

## First-Principles Reasoning

- Objective: Make every future capture usable for audience/timeframe Tasty
  Packs without over-structuring creative performance mechanics.
- Placement logic: First-load behavior changed, so `SKILL.md` owns the normal
  workflow. Detailed function arguments and storage mapping live in
  `references/resource-bank-contract.md`.
- Expected behavior delta: The next ingestion should create a Resource Bank job,
  primary asset with facets, analysis with first-3-seconds and retention notes,
  optional skill findings, and retrieval proof through `createTastyPack`.
- Proof needed: Link and stale-reference check, line-count review,
  skill-maintenance structure checklist self-check, and checker limitation
  recorded.

## Binary Rubric

| Check | Verdict | Evidence |
| --- | --- | --- |
| `first_load_sufficiency` | pass | `SKILL.md` now names Resource Bank writes, facets, hook/retention analysis, and verification. |
| `reference_load_precision` | pass | Reference Map points to `resource-bank-contract.md` for storage commands and fields. |
| `missing_context_rate` | pass | Required gates remain in the Todo List and signature. |
| `noisy_context_rate` | pass | Detailed Convex function argument map moved to reference; long positive example shortened during post-QA. |
| `duplicated_instruction_count` | pass | Stale `content item` wording and old storage names removed from active skill/reference files. |
| `prompt_size_tokens` | pass | First-load `SKILL.md` is 271 lines, slightly above the soft 250-line review threshold but below the hard 400-line failure threshold; remaining extra lines are active gates/output contract. |
| `task_success_rate` | unknown | No live ingestion run was executed as part of this skill edit. |
| `review_tas_rate` | unknown | No independent reviewer lane was used; change is local and bounded. |
| `maintenance_locality` | pass | Storage details are in one Resource Bank reference; normal workflow remains in `SKILL.md`. |
| `composition_clarity` | pass | Signature names reads, writes, gates, routes, and failure modes. |

## Proof Artifacts

- Skill-local evals, when needed: not required for this wording-only behavior
  alignment.
- Structure evals, when needed: not required.
- Reviewer receipt: self-check only.
- Validator:
  ```bash
  rg -n 'Content item|content item|Content kind|content kind|Notes stored|contentItems|content:add|content:get|source kind `manual`|output_type|LocalPinterest|localpinterest' /Users/kenjipcx/.codex/skills/ingest-content/SKILL.md /Users/kenjipcx/.codex/skills/ingest-content/references || true
  test -f /Users/kenjipcx/.codex/skills/ingest-content/references/resource-bank-contract.md && test -f /Users/kenjipcx/.codex/skills/ingest-content/references/reuse-taxonomy.md && test -f /Users/kenjipcx/.codex/skills/ingest-content/references/phase-router.md
  wc -l /Users/kenjipcx/.codex/skills/ingest-content/SKILL.md /Users/kenjipcx/.codex/skills/ingest-content/references/*.md
  ```
- Eval required: no.
- Checker limitation: `python3 /Users/kenjipcx/.codex/skills/skill-maintenance/scripts/check_skills.py --write` fails from the installed-copy path with `RuntimeError: could not find Farplane repo root`.
- Evidence gaps: The next real ingestion should prove the new facets populate
  and `createTastyPack` finds the saved asset by timeframe and audience.

## Before Behavior

- Create LocalPinterest content item, asset, analysis, and notes.
- Save reusable elements mostly through tags, analysis takeaways, and prompt
  guesses.
- Verify through `content:getContentItem`.

## After Behavior

- Create Resource Bank ingestion job, primary asset, analysis, and optional
  skill findings.
- Fill retrieval facets: `outputTypes`, `audiences`, `ageRanges`, `industries`,
  `customerRoles`, and optional `tastinessScore`.
- Store first-three-seconds hook and later retention beats in analysis text.
- Verify through `getResourceAsset` and `createTastyPack`.
- Return a Resource Bank-shaped packet: job ID, asset ID, asset kind, facets,
  analyses, optional skill findings, verification, and downstream reuse handle.

## Followups

- Create a repo-owned source package or import path for `ingest-content` if this
  skill should be versioned with Farplane rather than only installed locally.
