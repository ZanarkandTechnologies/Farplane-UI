---
kind: feature-spec
status: active
project: Farplane UI
created_at: 2026-08-12
updated_at: 2026-08-12
owner: leverage
related_systems:
  - ../systems/README.md
source_refs:
  - ../../ARCHITECTURE.md
  - ../../docs/MEMORY.md
  - ../../ui/server/leverage-projection.ts
  - ../../ui/server/leverage-types.ts
  - ../../ui/src/modules/leverage/README.md
  - ../../ui/src/modules/finance/README.md
  - FEAT-0116-global-finance-observations.md
  - FEAT-0114-dashboard-projection-architecture.md
---

# Leverage Resource Workspace

Leverage is the one visible workspace for the operator's compounding resources:
company Capital, owned-account Distribution, and project Edge. It composes
existing read models; it is not a personal-resource ERP, source collector, or
second finance ledger.

```text
finance projection + registered project snapshots
  -> GET /farplane/finance + GET /farplane/leverage
  -> Capital + account-grouped Distribution + project Edge + evidence gaps
  -> one full-workspace Leverage panel
```

## Product Decisions

- **Capital is company-level.** The company has one finance sidecar and bank
  account, so cash is not allocated or duplicated per project. Finance remains
  the owner of dated cash, flow, close, and source-gap evidence; Leverage only
  renders its Capital section.
- **Distribution is account-level.** A project can use the same social account
  as another project. Numeric project metrics marked `leverage: distribution`
  therefore group by observed `(platform, account_id)`, not project, metric
  name, or display label. One account card lists every project that uses it.
- **Edge is qualitative, not a score.** Each project may have exactly one
  `leverage: edge` Markdown metric. Its latest valid paragraph is shown as one
  project row. The panel never converts it into a numeric strength score.
- **One visible entrypoint.** Office menu and command-palette actions, the cash
  HUD, and the Finance Office room all open Leverage. Finance has no separate
  visible launcher or panel.

## Evidence And Storage Contract

`farplane/metrics.yaml` defines what a project measures and how it refreshes;
dated observations under `.farplane/metrics/` hold the latest evidence. The
compiled `.farplane/project/ui/latest.json` snapshot is a read model, never the
source of truth. A requested calendar window and timezone produce current,
comparison, and flow cumulative views in Core; timeframes and derived growth
metrics do not belong in `metrics.yaml`.

An Edge refresher is the AI instruction that updates the field. It should
summarize verified new or strengthened advantages into one Markdown paragraph,
update an existing claim when it has changed, and emit a source gap rather than
invent a claim. The Edge metric is `pinned: true` so Daily refreshes it, but it
stays unselected so it is not promoted into a planning objective.

```yaml
metrics:
  edge:
    label: Edge
    description: Current evidence-backed advantage.
    type: markdown
    pinned: true
    leverage: edge
    refresh: >-
      Summarize verified evidence that materially strengthens this project's
      advantage; replace the current paragraph only when the evidence changed.

  instagram_followers:
    label: Instagram followers
    type: stock
    unit: followers
    direction: maximize
    leverage: distribution
    refresh_ref: instagram_account_metrics
```

A distribution collector attaches account identity to its dated observation,
not the tracked metric definition:

```json
{
  "metric_id": "instagram_followers",
  "date": "2026-08-12",
  "value": 921,
  "status": "available",
  "payload": {
    "distribution_account": {
      "platform": "instagram",
      "account_id": "provider-owned-id",
      "label": "@operator"
    }
  }
}
```

Same-day identical Edge text is deduplicated. Conflicting same-day text or a
malformed/missing Edge refresh becomes a dated source gap and retains the last
valid paragraph. An absent account identity is likewise a source gap; Leverage
does not guess it from a metric name or a project.

## Projection And Privacy Contract

The Leverage panel reads `GET /farplane/finance` for Finance-owned Capital
detail and `GET /farplane/leverage` for the registered, deduplicated
`company.projects[].trackingContext` projection. The latter extracts only the
explicit Distribution and Edge cards from each project snapshot. Missing
tracking context, unreadable snapshots, stale readings, unavailable values, and
absent account identity stay visible as evidence gaps rather than zeroes.

The browser receives no provider account ID, raw observations, project strategy,
or private finance evidence. The account card uses an opaque derived ID and
shows a human account label plus `Used by` projects. The Capital detail uses the
existing browser-safe Finance projection; neither endpoint writes source state.

## Surfaces

| Surface | Owner | Role |
| --- | --- | --- |
| `~/.farplane/finance` | Finance CLI and collectors | Canonical company cash, flow, close, and receipt evidence. |
| `farplane/metrics.yaml` + `.farplane/metrics/` | Project refreshers and Core | Metric definition plus dated project evidence. |
| `.farplane/project/ui/latest.json` | Core snapshot compiler | Read-only project card projection. |
| `GET /farplane/finance` | Finance projection | Browser-safe Capital detail. |
| `GET /farplane/leverage` | `ui/server/leverage-projection.ts` | Browser-safe Distribution, Edge, and evidence-gap projection. |
| `LeveragePanel` | `ui/src/modules/leverage/` | The single full-workspace resource UI. |

## Limits

- No project-level cash allocation while there is one company finance account.
- No resource score, ranking algorithm, or inferred Edge.
- No manual account-ID configuration in `metrics.yaml`, and no account ID in the
  browser response.
- No collection, refresh, or durable write initiated by the panel.
- No second Finance launcher, panel state, or competing capital dashboard.

## Proof

- `ui/server/leverage-projection.test.ts` proves account grouping, source-gap
  behavior, project-path deduplication, deterministic conflict handling, and
  Edge rows.
- Module hook tests prove both browser-safe projection routes.
- Office registry, shell, store, room-catalog, and render-policy tests prove
  every capital entrypoint opens the single Leverage state.
- Browser QA verifies a full-size Leverage workspace, one grouped account card,
  Capital detail, Edge rows, and visible evidence gaps.
