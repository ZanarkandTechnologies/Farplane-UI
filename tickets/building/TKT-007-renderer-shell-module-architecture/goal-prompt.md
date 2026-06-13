# Native Goal Prompt

```text
/goal Run tickets/building/TKT-007-renderer-shell-module-architecture/ticket.md as a Goal Packet.

Task: Complete TKT-007 by making Farplane UI's renderer/module architecture explicit and executable. Create docs/specs/module-shell-architecture.md, update compact repo/module rules, and add the first ui/src/shell documentation seam. Preserve the ticket boundaries: renderer is standard | office3d, modules are static folder/import boundaries registered explicitly by the shell, any ModuleId type is derived from the registry, ui/src/lib owns shared helpers only after real reuse, no console module, no dynamic JS plugin loader, no packages/ boundary, and no broad Sigmax/Aikage/Farplane Console feature migration in this ticket.

Logging: Before ending each turn, append a compact structured entry to tickets/building/TKT-007-renderer-shell-module-architecture/progress.md with trigger, intent, actions, files/artifacts, metric or feedback sample, drift verdict, next_action, and blockers.

Metric: Satisfy the Done / Proof block in tickets/building/TKT-007-renderer-shell-module-architecture/ticket.md using hybrid evidence: git diff --check, focused import/type/test checks only if code files move, and review judgment that the spec/rules make the renderer-module boundary legible without expanding scope.

After each turn: Compare progress against ticket.md and program.md, then continue from the largest unresolved acceptance/evidence gap, create follow-up tickets for feature migration overflow, stop complete only when the Done / Proof conditions and verification are recorded, or report blocked with attempted paths and one missing input.
```
