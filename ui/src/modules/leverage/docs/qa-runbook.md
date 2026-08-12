# Leverage QA Runbook

1. Start `corepack pnpm run ui` with an isolated `FARPLANE_STATE_DIR` whose
   `company.json` has one fresh, one stale, and one missing project snapshot.
2. Open Office → command palette → **Leverage** (or use the dev QA bridge).
3. Confirm capital is read from Finance; no per-project cash value appears.
4. Seed two project snapshots with the same `(platform, account_id)` and confirm Distribution
   renders one account card with `Used by: <project A> · <project B>`. Confirm the raw account ID
   is not present in the endpoint response or DOM.
5. Confirm Edge is a project-per-row list with its current paragraph or an explicit unavailable/missing/not-configured state.
6. Confirm stale/missing/unreadable projects remain visible as evidence gaps, not zeroes.
7. Capture the panel, console errors, and page errors.
