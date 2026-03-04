# Text to 3D Reference

Endpoint family: `/openapi/v2/text-to-3d`

## Core flow

1. Create preview task (`mode: "preview"`, requires `prompt`)
2. Poll task by ID until `status: SUCCEEDED`
3. Create refine task (`mode: "refine"`, requires `preview_task_id`)
4. Poll refine task until complete and read `model_urls`

## Key request fields

- `prompt` (required for preview, max 600 chars)
- `model_type`: `standard` | `lowpoly`
- `ai_model`: `meshy-5` | `meshy-6` | `latest`
- `topology`: `quad` | `triangle`
- `target_polycount`: 100..300000
- `should_remesh`: bool
- `symmetry_mode`: `off` | `auto` | `on`
- `moderation`: bool

Refine extras:
- `enable_pbr`: bool
- `texture_prompt` or `texture_image_url`
- `remove_lighting` (meshy-6/latest)

## Useful responses

- Create: `{ "result": "<task_id>" }`
- Retrieve: includes `status`, `progress`, `model_urls`, `texture_urls`, `task_error`

## Common failure modes

- `400`: missing/invalid parameters, prompt too long
- `401`: invalid API key
- `402`: insufficient credits
- `429`: rate limited

## Notes

- `art_style` is deprecated for Meshy-6 integrations; avoid in new code.
- Use SSE endpoint for live progress when building interactive UIs.
