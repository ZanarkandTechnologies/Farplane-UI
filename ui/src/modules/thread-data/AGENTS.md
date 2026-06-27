# Thread Data Module

- Owns the Chat History Mining Programs Platform from `tickets/TASK-0020`.
- Keep program and run artifacts file-backed under `.farplane/backfill`.
- Do not store mined outputs only in React state.
- Keep promotion/rejection explicit; generated outputs start as `unreviewed`.
- UI should remain dense and operational: tabs, tables, filters, and artifact viewers over explanatory copy.
