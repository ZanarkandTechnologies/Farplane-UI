# Metrics Convex Module Contract

- Own `metricReadings`: one row per project + metric + time; latest is the newest row, history is all rows.
- Cash is metric `cash` with source `bank`; no finance module.
- Writes are internal (token-checked `/metrics/readings`); reads are internal, over the token-checked `/metrics/latest` and `/metrics/history` routes; every route fails closed (503) without a deployment token.
- Test: `npx vitest run convex/modules/metrics`
