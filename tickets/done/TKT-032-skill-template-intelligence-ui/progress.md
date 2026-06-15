---
id: TKT-032
title: Skill OS template intelligence UI progress
status: active
created_at: 2026-06-14
updated_at: 2026-06-14
---

# TKT-032 Progress

## 2026-06-14 Goal Start

- trigger: paired Goal execution for Farplane TASK-0202 and Farplane-UI TKT-032
- current_state:
  - `SkillOsStandardsTab` currently derives counts from graph/frontmatter only
  - no generated template intelligence artifact loader exists yet
- next_action: add model/loader/rendering for the Standards / Rollout workbench

## 2026-06-14 Initial Completion

- changed:
  - added generated artifact loading to `use-skill-graph-data.ts`
  - added template intelligence payload types
  - added `skill-os-standards-model.ts`
  - replaced Standards / Rollout with Template Summary, Feature Registry,
    History / Diffs, Common Evals, and Rollout Matrix sections
  - synced the generated artifact into the installed skill-maintenance graph
    directory for local UI proof
- verification:
  - `npm run typecheck:root` passed
  - Browser QA screenshots captured:
    - `skill-os-standards-summary.png`
    - `skill-os-standards-common-evals.png`
    - `skill-os-standards-features.png`
    - `skill-os-standards-history.png`
- result: complete

## 2026-06-14 Correction Pass

- correction:
  - top-level Skill OS tabs moved into a top-right dropdown
  - Standards / Rollout subviews moved into a top-right dropdown
  - Standards now defaults to Rollout Matrix
  - `Feature Registry` renamed to `Skill Registry` and rendered as rows
  - `History / Diffs` renamed to `Template Versions` and grouped by release
  - `Template Summary` and `Common Evals` removed from the UI contract
  - dense panel guidance added to `ui/src/modules/AGENTS.md`
- Farplane source-of-truth update:
  - template intelligence generator now emits grouped `template_versions`
  - `check_skills.py --write` regenerates the template intelligence artifact
  - skill-system docs now treat template source edits as release events
- verification:
  - `npm run typecheck:root` passed
  - `python3 skills/skill-maintenance/scripts/test_generate_template_intelligence.py` passed
  - `python3 skills/skill-maintenance/scripts/check_skills.py --write` passed
  - `python3 docs/features/validate_features.py` passed
  - browser QA screenshots captured:
    - `skill-os-standards-compact-rollout.png`
    - `skill-os-standards-skill-registry.png`
    - `skill-os-standards-template-versions.png`
- result: corrected

## 2026-06-14 Skill OS Mode Nav Exception

- correction:
  - restored visible top-level Skill OS tabs for `Skill Tree`, `Invocations`,
    and `Standards / Rollout`
  - kept the Standards / Rollout inner view selector as a compact dropdown
- reason:
  - this panel has enough horizontal room for the three main modes, and the
    dropdown left the header row feeling unnecessarily empty
- verification:
  - `npm run typecheck:root` passed
  - `git diff --check` passed
