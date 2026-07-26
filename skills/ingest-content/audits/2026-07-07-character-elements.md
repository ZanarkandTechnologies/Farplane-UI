---
skill: ingest-content
date: 2026-07-07
change_type: behavior
owner: skill-maintenance
status: pass
review_route: self_check
before_ref: skills/ingest-content/SKILL.md
after_ref: skills/ingest-content/SKILL.md
reasoning_basis: user_request + Resource Bank module contract
proof_artifacts:
  - skills/ingest-content/SKILL.md
  - skills/ingest-content/references/phase-router.md
  - skills/ingest-content/references/resource-bank-contract.md
  - skills/ingest-content/references/reuse-taxonomy.md
eval_required: no
---

# Skill Audit

## Change

- Before: `ingest-content` extracted visual/audio/hook/storyboard/editing/copy/format/constraint elements but did not teach future ingests to treat distinctive character or persona as a first-class creative element.
- After: `ingest-content` extracts `character` elements for distinctive personas, archetypes, guides, hosts, mascots, and recurring figures, pins them only when grounded in the operator note, and stores rights-safe remix constraints for recognizable identities.
- Why: Kenji identified the Railway/Gilfoyle advert's character as a major reusable ingredient, and the Resource Bank schema now supports `character` alongside the existing creative element kinds.
- Tradeoff accepted: The Resource Bank model remains source asset plus analysis plus creative elements. No separate production object or planning-priority field was added.

## First-Load Review

```text
first_load_review:
  line_count_before: 282
  line_count_after: 287
  kept_in_skill: normal-path extraction and pinning rules for character elements
  moved_to_reference: detailed character element example and rights-safe remix constraints
  deleted_as_duplicate_or_rationale: none
  extra_sections_kept_with_reason: existing sections retained; no new top-level sections
  remaining_sections_over_budget: SKILL.md remains above the 250-line soft review threshold because it carries the full ingestion workflow, storage writes, and verification contract
  proof_surface_fit: docs/skill contract and focused text checks; no live Convex ingest needed for wording-only skill behavior alignment
  task_case_quality: no eval case added because Resource Bank code/tests already cover character rows and this change is skill instruction alignment
  anti_cheat_case_design: not applicable; no eval query added
  qa_preflight_loaded: pass
  qa_finish_independence: self-check; bounded repo-local skill docs change
  qa_gotcha_deduplication: pass
  project_specific_context_isolation: pass; Railway/Gilfoyle context is not embedded in first-load docs
  low_value_prose_scan: pass; added text changes extraction, pinning, or rights-safety behavior
  verdict: pass
```

## Proof Notes

- Checked local Resource Bank contract: `convex/modules/resourceBank/validators.ts` already includes `character` in `creativeElementKindValidator`.
- Checked Resource Bank README: core model is still `ingestion job -> primary asset -> analysis summary -> creative elements -> optional skill findings`.
- Relevant checks to run after edit: `npm run test:skills`, focused `rg` checks for character extraction, and available Resource Bank tests if the dirty worktree allows them.
