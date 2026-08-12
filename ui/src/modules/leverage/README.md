# Leverage Module

This panel combines three existing owners without creating a personal resource ERP:

- Capital comes from the global Finance projection.
- Distribution comes from project snapshot cards explicitly marked `leverage: distribution`.
  Each collector snapshot supplies its canonical `(platform, account_id)` identity;
  the panel groups those rows once per owned account and shows `Used by` for every
  project that uses it. The browser receives an opaque account-card ID, never the
  provider account ID. Missing identity is an evidence gap until the collector is refreshed.
- Edge is a single project-per-row list from the one `leverage: edge` Markdown
  metric permitted per project. Missing or unreadable project evidence remains
  explicit on that row.

The browser receives only `GET /farplane/leverage`. The server reads registered
`company.projects[].trackingContext` paths, deduplicates them, and reports missing,
stale, or unreadable evidence as gaps. It does not read project strategies, raw
observations, or private source material.
