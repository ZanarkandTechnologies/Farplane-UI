#!/usr/bin/env python3
"""Generate a furniture/decor asset for office personalization."""

from __future__ import annotations

import argparse
import json
from meshy_api import MeshyClient, wait_for_task


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create furniture asset with Meshy")
    parser.add_argument("--prompt", required=True, help="Furniture prompt")
    parser.add_argument("--model-type", default="lowpoly", help="standard|lowpoly")
    parser.add_argument("--ai-model", default="latest", help="meshy-5|meshy-6|latest")
    parser.add_argument("--topology", default="triangle", help="quad|triangle")
    parser.add_argument("--target-polycount", type=int, default=15000, help="Target polycount for remesh")
    parser.add_argument("--do-remesh", action="store_true", help="Run remesh after refine")
    parser.add_argument("--do-retexture", action="store_true", help="Run retexture after base generation/remesh")
    parser.add_argument("--style-prompt", default="", help="Retexture style prompt")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    client = MeshyClient()
    print(f"Current credits: {client.get_balance().get('balance')}")

    preview_id = client.create_text_to_3d_preview(
        {
            "mode": "preview",
            "prompt": args.prompt,
            "ai_model": args.ai_model,
            "model_type": args.model_type,
            "moderation": False,
        }
    )
    wait_for_task(client.get_text_to_3d_task, preview_id)

    refine_id = client.create_text_to_3d_refine(
        {
            "mode": "refine",
            "preview_task_id": preview_id,
            "ai_model": args.ai_model,
            "enable_pbr": True,
            "remove_lighting": True,
        }
    )
    refine = wait_for_task(client.get_text_to_3d_task, refine_id)

    current_task_id = refine_id
    remesh = {}
    retexture = {}

    if args.do_remesh:
        remesh_id = client.create_remesh(
            {
                "input_task_id": current_task_id,
                "target_formats": ["glb", "fbx", "obj", "usdz"],
                "topology": args.topology,
                "target_polycount": int(args.target_polycount),
            }
        )
        remesh = wait_for_task(client.get_remesh_task, remesh_id)
        current_task_id = remesh_id

    if args.do_retexture:
        if not args.style_prompt.strip():
            raise RuntimeError("--style-prompt is required when --do-retexture is used")
        retexture_id = client.create_retexture(
            {
                "input_task_id": current_task_id,
                "text_style_prompt": args.style_prompt.strip(),
                "enable_original_uv": True,
                "enable_pbr": True,
            }
        )
        retexture = wait_for_task(client.get_retexture_task, retexture_id)
        current_task_id = retexture_id

    output = {
        "preview_task_id": preview_id,
        "refine_task_id": refine_id,
        "last_task_id": current_task_id,
        "refined_model_urls": refine.get("model_urls", {}),
        "remesh_model_urls": remesh.get("model_urls", {}),
        "retexture_model_urls": retexture.get("model_urls", {}),
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
