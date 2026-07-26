---
kind: feature-spec
status: active
project: Farplane UI
created_at: 2026-07-20
updated_at: 2026-07-22
owner: finance
related_systems:
  - ../systems/README.md
source_refs:
  - ../../ARCHITECTURE.md
  - ../../docs/MEMORY.md
  - ../../farplane/metrics.yaml
  - ../../ui/src/modules/telemetry/lib/finance-metric-rollup.ts
external_grounding:
  - https://docs.slash.com/docs/sdks
  - https://docs.slash.com/api-reference/account-balance-get
  - https://docs.slash.com/api-reference/transaction-aggregation-get
---

# Global Finance Observations

Farplane owns one firm-level finance observation store under
`~/.farplane/finance`. It is local-first product state for the company, not a
project ledger, browser cache, or duplicate bank transaction ledger.

## Behavior Contract

```text
statement/provider observation -> dated signed company cash snapshot
daily flow collector -> normalized non-negative income/expense observations
both -> browser-safe finance projection -> Finance panel and office money HUD
```

- Daily observations are idempotently replaceable by date, currency, and
  source; each source component carries both flow totals so a backfill can
  correct an incomplete reading without double count.
- Actual income and expense stay separate and non-negative. Net cash flow is a
  derived value: `incomeCents - expenseCents`.
- The AI-office operating window is Monday-through-Sunday in the operator's
  local timezone. A weekly close is immutable after creation unless an explicit
  replacement command records a new receipt.
- Calendar-month totals are derived from daily observations. A month-close
  snapshot may freeze the same projection without becoming a second ledger.
- Company cash is a stock value, separate from income/expense flow. Each dated
  snapshot is append-only by default; correcting the same date requires an
  explicit replacement and produces an audit receipt.
- The first slice has one global company balance per date and currency. Account
  aggregation, personal net worth, and team-level balances are intentionally
  deferred.
- Slash and other banking providers remain upstream sources of truth. Farplane
  stores aggregates, coverage, freshness, and sync receipts rather than raw
  transaction payloads.
- Project accounts, project account events, and team ledgers keep their existing
  project-scoped ownership and do not mutate from global finance reads.

## Sidecar Contract

```text
~/.farplane/finance/
  observations/daily/YYYY-MM-DD.json
  snapshots/balance/YYYY-MM-DD.json
  snapshots/weekly/YYYY-Www.json
  snapshots/monthly/YYYY-MM.json
  sync/state.json
  sync/receipts/<run-id>.json
  ui/latest.json
```

Provider credentials and coordinates live in private `~/.farplane/config.toml`.
They never enter observation files or browser projections.

## Application Surfaces

- `farplane-ui finance record` writes a manual actual observation.
- `farplane-ui finance snapshot record --balance <amount> --as-of YYYY-MM-DD`
  writes a signed company cash snapshot. `--evidence` remains private and
  `--replace` is required for a same-date correction.
- `farplane-ui finance backfill slash` refreshes an exact inclusive daily
  window when Slash credentials are configured.
- `farplane-ui finance close-week` freezes the completed or selected office
  week and writes an audit receipt.
- `GET /farplane/finance` returns only the browser-safe compiled projection.
- The global Finance panel leads with latest company cash and balance history,
  then shows current week/month flow, provider freshness, and source gaps.
- The office money HUD reads the same projection and displays company cash:
  negative red, positive green, zero neutral.
- Desired-state automations run the read-only Slash backfill daily at 05:15 and
  close the prior completed week on Monday at 05:20 in Asia/Kuala_Lumpur.

## Limits

- Net cash flow is not accounting profit. Transfers, loans, owner funding, and
  uncategorized bank movement must not be described as money earned.
- The first implementation is single-instance under `~/.farplane`; multi-user
  synchronization is deferred until Farplane has an explicit hosted state
  owner.
- No automatic transfer, card, invoice, or payment mutation is in scope.

## Proof

- A manual `$400` expense produces one daily observation and a red `-$400`
  weekly-flow projection without changing company cash.
- A `-$400` company cash snapshot produces one dated balance, a receipt, and a
  red `-$400` Finance/HUD value; its evidence reference never reaches the browser.
- Repeating the same backfill does not double count.
- A weekly close totals only its local Monday-Sunday window and remains stable
  after later daily observations.
- The browser receives no provider keys, raw transactions, or private config.
