# Image to Image Reference

Endpoint family: `/openapi/v1/image-to-image`

## Use cases in this skill

- Style-transfer furniture/character concept images before 3D conversion
- Create consistent visual references for multi-image-to-3d

## Key request fields

- `ai_model`: `nano-banana` | `nano-banana-pro` (required)
- `prompt` (required)
- `reference_image_urls` (required, 1..5)
- `generate_multi_view` (optional)

## Flow

1. Create task
2. Poll by task ID
3. Use resulting image(s) as references for image-to-3d or multi-image-to-3d
