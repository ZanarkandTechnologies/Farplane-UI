# Thread Data Module

- Owns the Chat History Mining Programs Platform from `tickets/TASK-0020`.
- Treat Core programs as immutable and consume routes, runs, and reports through the Core mining adapter.
- Keep Convex optional; do not store mined outputs only in React state.
- Keep promotion/rejection explicit; generated outputs start as `unreviewed`.
- UI should remain dense and operational: tabs, tables, filters, and artifact viewers over explanatory copy.
