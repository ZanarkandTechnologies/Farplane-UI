# Skills Studio Module

- Keep skill metadata parsing, normalization, and serialization here.
- Runtime skill inventory models come from `modules/runtime`.
- Office UI panels may import from this module, but skill file semantics should stay here.
- Skill OS has one graph home and one mutually exclusive selected-skill workspace. The graph owns
  discovery and maintenance filters. A selected skill exposes Overview, Runbook, conditional
  Experiments, and Files. Keep declared QA checklists distinct from SKILL.md Todo and QA Tasks.
- Template rollout and signal data may inform graph filters and skill status, but do not recreate
  separate top-level dashboards unless they gain a concrete operator action.
