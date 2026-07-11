---
kind: farplane-config-index
status: active
created_at: 2026-06-17
updated_at: 2026-07-12
framework_template_version: "0.3.0"
---

# Farplane Config

Tracked project framework config lives here.

`manifest.json` owns the compact UI identity card. Richer project meaning
lives in tracked project files: `harness.yaml` is the typed human charter,
descriptive-product/capability map, and active metric selection;
`metrics.yaml` owns reusable metric meaning, direction, freshness, and guard
rules. Skills own recurring workflows; tickets own execution and proof.

```text
farplane/
  README.md        # this index
  manifest.json    # versioned Farplane project spec for this project
  harness.yaml     # typed charter, products, capability refs, metric selection
  metrics.yaml     # metric definitions, direction, freshness, guard rules
  automations.toml # one Work Pulse heartbeat plus separate scheduled sources
  bindings.yaml    # non-secret project IDs, provider coordinates, refresh bindings
  hooks.json       # declarative Farplane-native hook config
  pm.json          # optional UI thread manifest for one visual project PM
```

Runtime state lives under `.farplane/` and is intentionally ignored by git.

```text
.farplane/
  README.md
  automation/
  content/ledger.jsonl
  metrics/daily/
  metrics/observations/
  project/ui/latest.json
  reports/
  evals/runs/
  logs/
```

Keep canonical project config in `farplane/`. Use `.farplane/` only for local
runtime state, generated projections, metric observations, reports, logs, and
continuation ledgers.

## Official Automation Presets

- `Work Pulse`: the only heartbeat; reconciles, dispatches, handles due
  check-ins, and refills an empty BAU board.
- `Daily/Weekly BAU`: problem reports and bounded already-evidenced
  maintenance, not new-direction planning.
- `Dogfood Improvement`: portfolio learning and bounded experiment packets;
  Work Pulse executes the selected tickets.
- `Feed Scout`: optional separate source report and bounded opportunity-ticket
  job when project-specific sources are configured.
