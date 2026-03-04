# Remesh Reference

Endpoint family: `/openapi/v1/remesh`

## Core flow

1. Create remesh task from `input_task_id` or `model_url`
2. Poll until complete
3. Download requested `target_formats`

## Key request fields

- Input:
  - `input_task_id` (Meshy task that succeeded) OR
  - `model_url` (glb/gltf/obj/fbx/stl URL or data URI)
- Remesh options:
  - `target_formats`: `glb`, `fbx`, `obj`, `usdz`, `blend`, `stl`
  - `topology`: `quad` | `triangle`
  - `target_polycount`
  - `resize_height`, `origin_at`
  - `convert_format_only`

## Common failure modes

- `400`: invalid input type, unsupported format, bad topology
- `401`: unauthorized
- `402`: insufficient credits
- `429`: rate limited

## Notes

- Use this before rigging if model is too dense.
- Use `convert_format_only` for fast format conversion pipelines.
