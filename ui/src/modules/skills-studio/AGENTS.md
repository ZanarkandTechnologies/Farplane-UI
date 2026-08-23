# Skills Studio Module

- Keep skill metadata parsing, normalization, and serialization here.
- Runtime skill inventory models come from `modules/runtime`.
- Office UI panels may import from this module, but skill file semantics should stay here.
- Skill OS has two page-level homes: Capability Map is the default, operator-facing
  discovery surface; Skill Library owns technical graph maintenance, filters, and
  selected-skill workspaces. Capability Map renders the seven declared operating
  departments above admitted real capability nodes: artifact skills appear as
  workstations and integration skills appear as system facilities. Drill-down
  reveals direct department membership plus declared artifact-flow edges where
  one capability's output matches another capability's input. It must not
  invent Todo calls, runtime scheduling, file refs, delivery state, or visual-only categories.
  A selected skill exposes Overview,
  Runbook, conditional Experiments, and Files. Keep declared QA checklists distinct
  from SKILL.md Todo and QA Tasks.
- Template rollout and signal data may inform graph filters and skill status, but do not recreate
  separate top-level dashboards unless they gain a concrete operator action.
