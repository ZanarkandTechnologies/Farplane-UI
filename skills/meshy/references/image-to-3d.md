# Image to 3D Reference

Endpoint family: `/openapi/v1/image-to-3d`

## Core flow

1. Create task with `image_url`
2. Poll `/image-to-3d/:id` until `SUCCEEDED`
3. Read `model_urls` + `texture_urls`

## Key request fields

- `image_url` (required, URL or data URI)
- `model_type`: `standard` | `lowpoly`
- `ai_model`: `meshy-5` | `meshy-6` | `latest`
- `topology`, `target_polycount`, `should_remesh`
- `save_pre_remeshed_model` (only with remesh)
- `should_texture`, `enable_pbr`
- `texture_prompt` or `texture_image_url`
- `image_enhancement`, `remove_lighting`
- `moderation`

## Common failure modes

- `400`: invalid image, unreachable URL, invalid parameter combination
- `401`: unauthorized
- `402`: insufficient credits
- `429`: rate limited

## Notes

- For office furniture from photos, this is often the fastest route.
- For texture consistency, chain this with retexture.
