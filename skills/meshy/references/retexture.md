# Retexture Reference

Endpoint family: `/openapi/v1/retexture`

## Core flow

1. Create task with:
   - source model (`input_task_id` or `model_url`)
   - style input (`text_style_prompt` or `image_style_url`)
2. Poll until `SUCCEEDED`
3. Read textured `model_urls` + `texture_urls`

## Key request fields

- Source:
  - `input_task_id` OR `model_url`
- Style:
  - `text_style_prompt` OR `image_style_url`
- Options:
  - `ai_model`
  - `enable_original_uv`
  - `enable_pbr`
  - `remove_lighting`

## Common failure modes

- `400`: missing source/style, unsupported model format, unreachable URL
- `401`, `402`, `429`: auth/credits/rate limit

## Notes

- Useful for making furniture sets match one office art direction.
- Run after geometry is stable to avoid repeating expensive texture passes.
