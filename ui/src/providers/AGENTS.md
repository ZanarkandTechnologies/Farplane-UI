# Providers

- Keep React lifecycle/orchestration in provider files and move pure data shaping into helper modules when the logic needs standalone tests or reuse.
- Office data mapping must preserve the sidecar/runtime split: structural office/company state is Farplane UI-owned under `~/.farplane`, Codex is the default runtime adapter, and OpenClaw runtime data only enters through the optional OpenClaw adapter. See `MEM-0176`.
- Do not reintroduce synthetic project/team furniture through provider fallback paths unless the fallback is explicitly for adapter-empty failure state.
