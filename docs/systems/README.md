---
kind: systems-index
status: active
project: Farplane UI
created_at: 2026-06-28
updated_at: 2026-08-12
framework_template_version: "1.6.4"
owner: harness
feature_index: ../features/README.md
---

# Systems

System docs describe product-layer groupings, boundaries, and ownership maps.
They point to first-class feature docs in `docs/features/FEAT-*.md`; they do
not replace those feature specs.

Generated registries such as `docs/systems/registry.jsonl` are views, not
hand-authored source of truth.

## Current State

The following system contract has a stable cross-feature owner:

- [Content Capture And Analysis](content-capture-and-analysis.md) — shared
  source/job identity, Resource Bank Save, Vidgard Analyze, Convex migration,
  and involved skill/caller boundaries.
- [Z-Index System](z-index-system.md) — bounded Office3D HTML overlays,
  isolated canvas containment, and the application layer contract.

For other product areas that have not yet split into stable system owner docs,
use:

- `docs/features/FEAT-0002-harness-product-model.md` for the product model and
  global/project surface split.
- `docs/features/FEAT-0001-operator-intelligence-modules-roadmap.md` for the
  current module family roadmap.
- `ARCHITECTURE.md` for the current top-level repo/system map.

## Migration Note

Do not invent system owner docs just to fill this folder. Add a system doc when
there is a real grouping boundary to maintain, such as a global harness system,
project/company system, runtime adapters system, office surface system, or proof
and review system.
