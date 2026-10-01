# Experiments Convex Module Contract

- Own `abTests`, `abSends` and `abSourceTotals` (an option's cumulative totals from its `metricSource`).
- The call (winner / same / inconclusive) stays with the office's `shared/abtest.ts`; queries return counts.
- Writes are internal (token-checked `/experiments/ab` with `op`); reads are internal, over the token-checked `/experiments/list` and `/experiments/get` routes; every route fails closed (503) without a deployment token.
- Fixtures and tests use fictional names only.
- Test: `npx vitest run convex/modules/experiments`
