# Finance Module Contract

- Own the browser-safe global finance projection, Capital detail component, and query hook.
- Never expose provider credentials, raw transactions, or browser write paths.
- Render income/expense as non-negative flows and derive signed net from cents.
- The latest company cash snapshot is the primary office value; weekly and monthly flows are secondary.
- Never expose a balance snapshot's local evidence reference in the browser projection.
- Use theme tokens and explicit loading, empty, error, stale, and source-gap states.
