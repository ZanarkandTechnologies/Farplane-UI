---
kind: farplane-config-index
status: draft
created_at: 2026-06-17
updated_at: 2026-06-17
framework_template_version: "0.1.0"
---

# Farplane Config

Tracked project framework config lives here.

This folder is the project-local declaration that Farplane UI should be able to
summarize as one autonomous company inside the broader harness cockpit.

```text
farplane/
  README.md        # this index
  manifest.json    # versioned Farplane project spec for this project
  harness.md       # mission, values, modes, systems, feedback loops
  goals.md         # north star, KPIs, current milestone, holds
  automations.md   # recurring jobs, schedules, reports, ticket source policy
  bindings.md      # non-secret project IDs, URLs, labels, aliases
  evals.md         # project-level proof and eval policy
  pm.json          # optional UI thread manifest for one visual project PM
```

Runtime state lives under `.farplane/` and is intentionally ignored by git.

```text
.farplane/
  README.md
  state/run-ledger.json
  reports/
  evals/runs/
  logs/
```

Keep canonical project config in `farplane/`. Use `.farplane/` only for local
runtime state, generated evidence, reports, logs, and continuation ledgers.
