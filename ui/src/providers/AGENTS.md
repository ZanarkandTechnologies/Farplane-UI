# Providers

- Keep React lifecycle/orchestration in provider files and move pure data shaping into helper modules when the logic needs standalone tests or reuse.
- Office data mapping must preserve the sidecar/runtime split: structural office/company state is Farplane UI-owned under `~/.farplane`, while OpenClaw runtime data only enters through an explicit adapter. See `MEM-0176`.
- Do not reintroduce synthetic project/team furniture through provider fallback paths unless the fallback is explicitly for adapter-empty failure state.
