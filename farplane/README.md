---
kind: farplane-config-index
status: active
created_at: 2026-06-17
updated_at: 2026-07-20
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
  brand.yaml       # default Brand Kit ID for approved creative identity
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

## Finance Metrics

Financial values remain ordinary metrics and use the existing observation and
freshness pipeline. A metric opts into portfolio finance roll-ups with:

```yaml
finance:
  flow: expense # expense | income
  basis: actual # actual | estimated
```

The metric `unit` is its currency (`usd`, for example). Portfolio totals group
by currency and observation window, and actual values never silently mix with
estimated values. A root `finance.expense_limit` in `metrics.yaml` may define
the global guard for one supported window such as `calendar_month`. Finance
observations are non-negative amounts; `flow` supplies their direction. Calendar
months use the observation's `YYYY-MM-DD` date and the operator's current local
month.

Firm bank-flow actuals use a separate instance-level owner:
`~/.farplane/finance`. The finance CLI records normalized daily income/expense,
performs read-only Slash backfills, and freezes weekly/monthly closes. The
Finance panel and HUD read its browser-safe projection; project metric finance
remains useful for attributed product/team reporting and does not become the
firm ledger.

## Official Automation Presets

- `Work Pulse`: the only heartbeat; reconciles, dispatches, handles due
  check-ins, and refills an empty BAU board.
- `Daily/Weekly BAU`: problem reports and bounded already-evidenced
  maintenance, not new-direction planning.
- `Dogfood Improvement`: portfolio learning and bounded experiment packets;
  Work Pulse executes the selected tickets.
- `Feed Scout`: optional separate source report and bounded opportunity-ticket
  job when project-specific sources are configured.
- `Daily Finance Backfill`: read-only prior-day Slash aggregate refresh.
- `Weekly Finance Close`: immutable Monday close of the prior completed week.
