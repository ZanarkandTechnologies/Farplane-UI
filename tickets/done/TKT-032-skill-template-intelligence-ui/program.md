---
id: TKT-032
title: Skill OS template intelligence UI program
status: complete
created_at: 2026-06-14
updated_at: 2026-06-14
---

# TKT-032 Program

```text
active_goal:
  render Farplane skill-template-intelligence data inside Skill OS Standards / Rollout

metric_provider:
  browser_qa + mechanical

metric:
  - Standards / Rollout includes Template Summary, Feature Registry, History / Diffs,
    Common Evals, and Rollout Matrix.
  - The UI reads the generated artifact contract when present and preserves an
    honest fallback when absent.
  - Skill OS graph-first tab and Invocations tab remain available.
  - Browser screenshot evidence is captured.

drift_policy:
  inline:
    - Farplane-UI reads generated skill governance data; it does not own it.
    - Do not browser-mine git history.
    - Do not add writer controls.
    - Do not mix Evals/Harness entrypoints back into Skill OS.

stop_condition:
  complete when UI proof and focused checks pass or blockers are recorded.
```
