---
skill: ingest-content
date: 2026-06-12
change_type: structure
owner: skill-creator
status: draft
review_route: advise
before_ref: none
after_ref: skills/ingest-content/SKILL.md
reasoning_basis: first_principles
proof_artifacts:
  - skills/ingest-content/SKILL.md
  - skills/ingest-content/references/localpinterest-contract.md
  - skills/ingest-content/references/reuse-taxonomy.md
eval_required: no
---

# Skill Audit

## Change

- Before: No Farplane skill owned Codex-native capture of liked links, files,
  screenshots, and media into the LocalPinterest vault.
- After: `ingest-content` owns the ingestion contract, routes source reading to
  existing media/text skills, writes Convex content/assets/analyses/notes, and
  verifies retrieval.
- Why: The operator wants to paste inspiration into Codex instead of building
  and maintaining a browser plugin or new agent app.
- Tradeoff accepted: v1 is chat/skill-operated and storage-first; graph UI,
  autonomous posting, metric loops, and creator recall remain later skills or
  tickets.

## First-Principles Reasoning

- Objective: Save tasty inspiration with enough analysis, tags, and reusable
  levers that future creative skills can retrieve and remix it.
- Placement logic: A Tier 3 content skill is the smallest Farplane-native owner
  because LocalPinterest already provides storage and existing skills already
  handle summarization, media ingest, and video understanding.
- Expected behavior delta: A pasted source plus note now has a repeatable path
  from read/extract to taste breakdown to Convex storage proof.
- Proof needed: Skill validation and one real ingestion run against
  LocalPinterest before claiming the full workflow is production-ready.

## Binary Rubric

| Check | Verdict | Evidence |
| --- | --- | --- |
| `first_load_sufficiency` | pass | `SKILL.md` includes trigger, signature, todo path, gates, and output. |
| `reference_load_precision` | pass | References are limited to LocalPinterest storage and reuse taxonomy. |
| `missing_context_rate` | pass | Required inputs and fallback branches are named. |
| `noisy_context_rate` | pass | Long storage details live in references, not first-load body. |
| `duplicated_instruction_count` | pass | Related skills are linked instead of copied. |
| `prompt_size_tokens` | pass | First-load file is compact for a pipeline skill. |
| `task_success_rate` | unknown | Needs a live ingestion run. |
| `review_tas_rate` | unknown | No reviewer lane has judged this new skill yet. |
| `maintenance_locality` | pass | Skill-specific rules live under `skills/ingest-content/`. |
| `composition_clarity` | pass | Boundaries to summarize, media-ingest, video-understanding, and production skills are explicit. |

## Proof Artifacts

- Skill-local evals, when needed: Not added; a real Convex ingestion fixture is
  the better first proof.
- Structure evals, when needed: Pending `check_skills.py --write`.
- Reviewer receipt: Not yet requested.
- Validator: Pending.
- Eval required: No for initial scaffold; yes later if the skill becomes a
  high-volume capture workflow.
- Evidence gaps: Need one saved LocalPinterest item from the supplied collage
  screenshot or another real source.

## Before Behavior

- Inspiration capture was brain-dump level and split across LocalPinterest app
  notes, archived extension proof, and general media skills.

## After Behavior

- A user can invoke `ingest-content` with `source + note` and expect a concrete
  capture packet, taste analysis, normalized tags, Convex writes, and retrieval
  proof.

## Followups

- Add a separate recall/reuse skill once saved assets exist.
- Add a graph/viewer ticket only after storage and query flows are proven.
- Spec autonomous posting and metric learning as a distinct content loop, not
  part of ingestion.
