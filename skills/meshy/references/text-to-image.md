# Text to Image Reference

Endpoint family: `/openapi/v1/text-to-image`

## Use cases in this skill

- Generate concept art before 3D generation
- Produce style boards for office furniture themes

## Key request fields

- `ai_model`: `nano-banana` | `nano-banana-pro` (required)
- `prompt` (required)
- `generate_multi_view` (optional)
- `pose_mode` (`a-pose`/`t-pose`, optional)
- `aspect_ratio` (optional, incompatible with `generate_multi_view`)

## Flow

1. Create task
2. Poll by task ID
3. Save `image_urls` for downstream image-to-3d
