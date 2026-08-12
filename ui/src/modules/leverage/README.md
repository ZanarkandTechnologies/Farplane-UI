# Leverage Module

The full product and data contract lives in
[`docs/features/FEAT-0120-leverage-resource-workspace.md`](../../../../docs/features/FEAT-0120-leverage-resource-workspace.md).

This is the single visible resource workspace. It combines three existing owners without
creating a personal resource ERP:

- Capital comes from the global Finance projection and includes cash flow, history, closes,
  and source gaps. The cash HUD and the Finance Office room both open this workspace.
- Distribution comes from project snapshot cards explicitly marked `leverage: distribution`.
  Each collector snapshot supplies its canonical `(platform, account_id)` identity;
  the panel groups those rows once per owned account and shows `Used by` for every
  project that uses it. The browser receives an opaque account-card ID, never the
  provider account ID. Missing identity is an evidence gap until the collector is refreshed.
- Edge is a single project-per-row list from the one `leverage: edge` Markdown
  metric permitted per project. Missing or unreadable project evidence remains
  explicit on that row.

The panel reads `GET /farplane/finance` for Finance-owned Capital detail and
`GET /farplane/leverage` for the global Distribution, Edge, and evidence-gap
projection. The Leverage server reads registered `company.projects[].trackingContext`
paths, deduplicates them, and reports missing, stale, or unreadable evidence as gaps.
It does not read project strategies, raw observations, or private source material.
