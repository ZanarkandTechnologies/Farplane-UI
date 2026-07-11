# Thread Data

Thread Data is a browser projection of Farplane Core mining state. The Vite
bridge calls the Core `farplane mining` CLI and returns browser-safe JSON for
immutable programs, project route bindings, MiningRuns, attempts, outputs, and
lean/deep reports.

Ownership boundaries:

- Core owns program packages, route validation and persistence, file-event
  classification, run creation, replay/rerun semantics, verdict persistence,
  report generation, and durable local state.
- The UI owns inspection, filtering, route-edit forms, replay/verdict actions,
  and presentation only.
- Convex hook telemetry is an optional event mirror and is not required to
  inspect Core programs, routes, runs, or reports.
- Pre-migration `.farplane/mine/runs/*` artifacts remain readable through a
  read-only compatibility projection. They are never used as semantic defaults
  for new runs.

Programs are inspect-only. Route edits call Core routes `set`/`remove`; replay
uses the frozen run contract. The UI must not infer a program from an event name
or recreate ticket-completion audit packets locally.
