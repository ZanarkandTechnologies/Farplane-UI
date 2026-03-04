---
name: office-decorator
description: Decorate and personalize the ShellCorp office through CLI-first workflows (print, list, add, move, remove, theme, meshy spec generation).
allowed-tools: Bash, Read, Write
---

# office-decorator

## Trigger

Use this skill when the operator says anything like:

- "decorate the office"
- "rearrange furniture"
- "show me the office layout"
- "change office theme"
- "add a custom mesh for office decor"

## Outcome contract (must happen)

- Inspect current office state before making changes.
- Apply requested layout/theme/object changes using `shellcorp office` commands.
- Print the office again for verification.
- Report exactly what changed (IDs, coordinates, theme).

## Workflow

1. Run `npm run shell -- office print` to inspect layout.
2. Run `npm run shell -- office list` and `npm run shell -- office teams` for object/team context.
3. Apply changes with `office add`, `office move`, `office remove`, and/or `office theme set`.
4. If custom asset is requested, run `office generate "<prompt>"` to save a meshy-compatible spec.
5. Re-run `office print` to confirm final state.
6. Summarize final object positions and theme.

## Command cookbook

- Print current office map:
  - `npm run shell -- office print`
- List all office objects:
  - `npm run shell -- office list`
- List only team clusters:
  - `npm run shell -- office teams`
- Add object:
  - `npm run shell -- office add plant --position -10,0,-10`
- Move object:
  - `npm run shell -- office move plant-a --position 0,0,0`
- Remove object:
  - `npm run shell -- office remove plant-a`
- Show theme:
  - `npm run shell -- office theme`
- Set theme:
  - `npm run shell -- office theme set cozy`
- Create Meshy asset spec:
  - `npm run shell -- office generate "small cactus desk plant" --style low-poly --type prop`

## Coordinate quick guide

- Coordinates are `x,y,z` with floor bounds around `-17.5` to `+17.5` on x/z.
- `x`: left (-) to right (+)
- `z`: back (-) to front/CEO area (+)
- `y`: height (usually `0` for floor objects)

## Decision branches

- If user asks for "show current state" only -> run `office print` + `office list`.
- If user asks for "move object" -> verify object exists via `office list` first.
- If user asks for "create custom object" -> run `office generate` first, then add as `custom-mesh` after asset is available.
- If user request is ambiguous -> ask for intended coordinates or nearest anchor object.

## Guardrails

- Never move objects outside floor bounds.
- Never delete objects unless explicitly asked.
- Keep team-cluster objects stable unless user asks to reposition teams.
- If a command fails, show the error and propose the corrected command.
