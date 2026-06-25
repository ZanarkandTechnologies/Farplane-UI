# Skills Studio Module

- Keep skill metadata parsing, normalization, and serialization here.
- Runtime skill inventory models come from `modules/runtime`.
- Office UI panels may import from this module, but skill file semantics should stay here.
- Skill OS top-level tabs are Workbench, Rollout, Templates, and Signals. Rollout owns feature
  coverage; Templates owns version history; Signals owns heat, invocations, tier, template status,
  and core workflow relevance. Do not move skill rollout into Harness OS; Harness OS can link to
  this module instead.
