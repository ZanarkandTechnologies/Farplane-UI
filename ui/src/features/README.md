# Legacy Features

`features/` contains older feature islands that predate the module standard.

Do not add new product/domain surfaces here. New durable UI work belongs under
`ui/src/modules/<domain>` with a module `README.md`, `AGENTS.md`, `index.ts`,
local components/hooks/lib, and colocated tests.

Current migration targets:

- `chat-system/` -> `modules/chat/`
- `nav-system/` -> `modules/navigation/`
- `remote-cua-system/` -> `modules/remote-cua/`
- `self-improvement-system/` -> `modules/self-improvement/` or
  `modules/skills-studio/` if the work is skill-training specific

Move one touched workflow at a time. Avoid broad rename-only diffs unless the
task is explicitly a migration cleanup.
