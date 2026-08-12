# Skills Studio Module

- Keep skill metadata parsing, normalization, and serialization here.
- Runtime skill inventory models come from `modules/runtime`.
- Office UI panels may import from this module, but skill file semantics should stay here.
- Skill OS has two page-level homes: Capability Map is the default, operator-facing
  discovery surface; Skill Library owns technical graph maintenance, filters, and
  selected-skill workspaces. Capability Map renders the seven declared operating
  departments above configured real workflow skills, then reveals those workflows'
  direct declared artifact methods on drill-down; it must not invent process links,
  runtime scheduling, integration leaves, or visual-only categories.
  A selected skill exposes Overview,
  Runbook, conditional Experiments, and Files. Keep declared QA checklists distinct
  from SKILL.md Todo and QA Tasks.
- Template rollout and signal data may inform graph filters and skill status, but do not recreate
  separate top-level dashboards unless they gain a concrete operator action.
