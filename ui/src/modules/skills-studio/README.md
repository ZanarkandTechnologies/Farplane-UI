# Skills Studio Module

Owns parsing and serialization helpers for file-backed skill metadata used by Skill Studio UI surfaces.

## Skill OS

Skill OS owns skill-only surfaces:

- `Workbench`: skill graph, skill docs, and drilldown.
- `Rollout`: template-version rollout, weighted skill health, and feature coverage.
- `Templates`: skill-template version history and archive metadata.
- `Signals`: heat, invocations, tier, template status, and core workflow relevance.

Rollout debt, heat, declared tier, and core relevance belong here because they answer which skills
should be maintained or compounded next.

Harness OS may link to Skill OS entrypoints, but it should not host skill rollout as a Harness OS tab.
