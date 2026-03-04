# Multi-Image to 3D Reference

Endpoint family: `/openapi/v1/multi-image-to-3d`

## Core flow

1. Create task with 1-4 `image_urls` of same object
2. Poll task status until `SUCCEEDED`
3. Collect `model_urls` for export

## Key request fields

- `image_urls` (required, 1..4)
- `ai_model`, `topology`, `target_polycount`
- `should_remesh`, `save_pre_remeshed_model`
- `should_texture`, `enable_pbr`
- `texture_prompt` or `texture_image_url`
- `image_enhancement`, `remove_lighting`, `moderation`

## Common failure modes

- `400`: invalid image count/format/URLs
- `401`: unauthorized
- `402`: insufficient credits
- `429`: rate limited

## Notes

- Best for character assets when you have front/side/back references.
- Keep images consistent in lighting and scale for better geometry.
