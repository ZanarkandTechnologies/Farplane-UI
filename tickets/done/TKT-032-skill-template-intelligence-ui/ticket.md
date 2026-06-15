---
id: TKT-032
title: Skill OS template intelligence UI
state: done
owner: Farplane UI
assignee: Codex
created_at: 2026-06-14
updated_at: 2026-06-14
complexity: M
depends_on:
  - TKT-031
  - Farplane TASK-0202
---

# TKT-032: Skill OS Template Intelligence UI

## Status

- state: `done`
- owner: Farplane UI
- assignee: Codex
- dependencies:
  - `TKT-031` owns the current Skill OS workbench and baseline Standards /
    Rollout entry point.
  - `Farplane TASK-0202` owns template history mining, archives, registry rows,
    and generated artifacts.
- location: `tickets/done/TKT-032-skill-template-intelligence-ui`
- enter when: operator wants Skill OS to show skill registry history, template
  versions, rollout drift, and release-style template metadata
- leave when: Skill OS Standards / Rollout becomes a compact template rollout
  workbench backed by Farplane-generated data
- blockers: none

## Description

Skill OS has a graph, invocations, and a Standards / Rollout surface. This
ticket upgrades Standards / Rollout into a compact release-style view for the
Farplane skill template intelligence artifact: Rollout Matrix first, Skill
Registry rows, and grouped Template Versions.

## Scope

- In:
  - Load a Farplane-generated `skill-template-intelligence` artifact when
    available.
  - Keep an honest current-state fallback from `skill-graph.json` /
    `skill-docs.json` when the generated artifact is missing.
  - Keep Skill OS mode switching as visible tabs when that better uses the
    otherwise empty panel row.
  - Move Standards subview switching into a compact top-right dropdown.
  - Make Rollout Matrix the first Standards / Rollout view.
  - Render Skill Registry as dense rows instead of cards.
  - Render Template Versions as grouped release rows.
  - Add module guidance for dense functional panels.
  - Capture browser screenshots proving the corrected Standards / Rollout UI.
- Out:
  - Do not mine git history in the browser.
  - Do not edit skill files or feature registry rows from Farplane UI.
  - Do not reintroduce Evals or Harness as nested Skill OS tabs.
  - Do not show template-summary or common-eval placeholder tabs.
  - Do not claim eval scores are universal skill quality rankings; future eval
    display should join real eval runs to template-active windows.

## Delta

- `Before:` Standards / Rollout used space-heavy tabs/cards and led with a
  summary instead of the actionable rollout state.
- `After:` Skill OS keeps its main modes as visible tabs. Standards / Rollout
  opens on the Rollout Matrix, keeps high-level numbers as a one-line scan bar,
  and exposes Skill Registry plus Template Versions from a top-right dropdown.
- `Why now:` The operator needs Skill OS to behave like a focused mini app:
  graph and rollout work surfaces get the space; mode switches become chrome.

## Program

```text
signature:
  render_skill_template_intelligence(skill_graph, skill_docs, template_artifact?)
    -> compact_standards_workbench + fallback_state + browser_evidence

vars:
  owner = ui/src/modules/skills-studio/components/skill-os
  source = Farplane TASK-0202 generated artifact
  fallback = current skill graph/docs frontmatter

program:
  load(source, fallback)
    -> SkillTemplateIntelligencePayload | current rollout rows

  render(adapter)
    -> Rollout Matrix | Skill Registry | Template Versions

  verify(done_when, proof)
    -> typecheck + browser screenshots
```

## Product Sketch

```text
Skill OS
+----------------------------------------------------------------------------+
| Graph-first Skill OS...                                                       |
+----------------------------------------------------------------------------+
| [Skill Tree] [Invocations] [Standards / Rollout]                             |
+----------------------------------------------------------------------------+
| current 15 | drift 69 | versions 3 | features 10 | generated ... [view v]  |
+----------------------------------------------------------------------------+
| Rollout Matrix                                                              |
| skill                 source   template   status    tier   features         |
| code-review           local    0.2.0      current   T2     --               |
| eval                  local    0.2.0      current   T3     FEAT-0054        |
| ...                                                                        |
+----------------------------------------------------------------------------+
```

```text
Skill OS / Standards / Skill Registry
+----------------------------------------------------------------------------+
| feature     name                         status       what it does  metrics |
| FEAT-0058   Skill template intelligence  implemented  ...           ...     |
+----------------------------------------------------------------------------+
```

```text
Skill OS / Standards / Template Versions
+----------------------------------------------------------------------------+
| version   first         latest        release summary              archive  |
| 0.2.0     00faed3596c1  22c8a84b53c9  working tree current...      ...      |
+----------------------------------------------------------------------------+
```

## Done / Proof

- UI:
  - Skill OS top-level mode switch remains visible tabs because the panel has
    enough horizontal room and the dropdown created empty space.
  - Standards / Rollout subviews moved to a top-right dropdown.
  - Rollout Matrix is the default Standards view.
  - Skill Registry uses dense rows instead of cards.
  - Template Versions groups archived snapshots by template release version.
- Farplane integration:
  - `check_skills.py --write` regenerates template intelligence after skill
    registry sync.
  - Farplane docs now state template source edits are release events and must
    refresh generated metadata/archive.
- Verification:
  - `npm run typecheck:root` passed.
  - `python3 skills/skill-maintenance/scripts/test_generate_template_intelligence.py` passed.
  - `python3 skills/skill-maintenance/scripts/check_skills.py --write` passed.
  - `python3 docs/features/validate_features.py` passed.
  - Browser screenshots:
    - `skill-os-standards-compact-rollout.png`
    - `skill-os-standards-skill-registry.png`
    - `skill-os-standards-template-versions.png`
    - `radial-without-skill-invocations.png`
