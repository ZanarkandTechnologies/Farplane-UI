---
name: meshy-office-3d
description: Generate and manage Meshy 3D assets for ShellCorp office scenes, with workflows for animated characters and furniture generation. Use when users ask for Meshy text/image-to-3D, remesh, rigging/animation, or office decor assets.
allowed-tools: Read, Write
metadata: {"openclaw":{"requires":{"env":["MESHY_API_KEY"]},"primaryEnv":"MESHY_API_KEY","homepage":"https://meshy.ai"}}
---

# meshy-office-3d

## Trigger

Use this skill when the user asks to:

- generate a 3D character or furniture asset
- animate a character for office scenes
- turn prompt/images into Meshy models
- remesh/retexture/export assets
- check Meshy credit balance

## Primary goals

1. Create nice character animations for office scenes.
2. Create furniture and decor assets for office personalization.

## Workflow (6 steps)

1. Identify target outcome: `animated-character` or `furniture`.
2. Choose input mode:
   - text prompt -> text-to-3d
   - one image -> image-to-3d
   - multiple images -> multi-image-to-3d
3. Generate base asset and wait for `SUCCEEDED`.
4. If needed, run remesh/retexture for cleaner topology/materials.
5. For characters, run rigging then apply animation action(s).
6. Save output links and write an office placement/usage note.

## Core decision branches

- **Animated character path**
  - Generate model (text/image/multi-image)
  - Remesh if needed
  - Rig model (humanoid only)
  - Apply animation task
  - Export `glb/fbx` URLs

- **Furniture path**
  - Generate model (prefer text-to-3d lowpoly or image-to-3d)
  - Optional remesh for poly target/export format
  - Optional retexture for style consistency
  - Export placement-ready `glb`

- **Spec-only fallback**
  - If user is ideating only, write a spec file under `~/.openclaw/assets/mesh/`
  - Do not hit Meshy APIs unless user asks to execute

## Top gotchas

1. `text-to-3d` is two-stage when using preview/refine; do not call refine until preview is `SUCCEEDED`.
2. Rigging currently works best for textured humanoid assets with clear limbs; non-humanoids will often fail.
3. Respect credit/rate limits and check balance before long generation batches.

## Fast start scripts

- Character animation workflow: `scripts/create_character_animation.py`
- Furniture workflow: `scripts/create_furniture_asset.py`
- Shared API helper: `scripts/meshy_api.py`

## References

- [text-to-3d](references/text-to-3d.md)
- [image-to-3d](references/image-to-3d.md)
- [multi-image-to-3d](references/multi-image-to-3d.md)
- [remesh](references/remesh.md)
- [rigging-and-animation](references/rigging-and-animation.md)
- [retexture](references/retexture.md)
- [text-to-image](references/text-to-image.md)
- [image-to-image](references/image-to-image.md)
- [balance](references/balance.md)

## Outcome contract

When execution is requested, return:

- task IDs created for each stage
- final downloadable asset URLs (at least `glb`, plus `fbx/usdz` when requested)
- brief office usage note (character role animation or furniture placement suggestion)
