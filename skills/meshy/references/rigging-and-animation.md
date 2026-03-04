# Rigging and Animation Reference

Endpoint families:
- Rigging: `/openapi/v1/rigging`
- Animation: `/openapi/v1/animations`

## Rigging flow

1. Create rigging task with `input_task_id` or humanoid `model_url`
2. Poll until `SUCCEEDED`
3. Read `result.rigged_character_glb_url` and base animations

## Animation flow

1. Create animation task with `rig_task_id` + `action_id`
2. Optional post-process (`change_fps`, `fbx2usdz`, `extract_armature`)
3. Poll until `SUCCEEDED`
4. Read animation URLs

## Rigging constraints

- Works best on textured humanoid models with clear limb structure
- Not recommended for non-humanoid/untextured meshes
- High-poly inputs can fail; remesh first (<=300k faces recommended)

## Common failure modes

- `400`: missing/invalid task or model
- `422`: pose estimation failed (not valid humanoid)
- `401`, `402`, `429`: auth/credits/rate limit

## Notes

- This is the primary path for “character animations in the office”.
- Start with one short test animation before batch generating actions.
