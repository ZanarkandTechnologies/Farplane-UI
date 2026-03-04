#!/usr/bin/env python3
"""Generate an animated character asset for office scenes.

Default pipeline:
1) Text-to-3D preview
2) Text-to-3D refine
3) Rigging
4) Animation
"""

from __future__ import annotations

import argparse
import json
from meshy_api import MeshyClient, wait_for_task


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create animated office character with Meshy")
    parser.add_argument("--prompt", required=True, help="Character prompt")
    parser.add_argument("--texture-prompt", default="", help="Optional texturing prompt for refine")
    parser.add_argument("--action-id", type=int, required=True, help="Meshy animation action ID")
    parser.add_argument("--enable-pbr", action="store_true", help="Enable PBR texture output")
    parser.add_argument("--ai-model", default="latest", help="meshy-5|meshy-6|latest")
    parser.add_argument("--model-type", default="standard", help="standard|lowpoly")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    client = MeshyClient()

    balance = client.get_balance()
    print(f"Current credits: {balance.get('balance')}")

    preview_id = client.create_text_to_3d_preview(
        {
            "mode": "preview",
            "prompt": args.prompt,
            "ai_model": args.ai_model,
            "model_type": args.model_type,
            "moderation": False,
        }
    )
    preview = wait_for_task(client.get_text_to_3d_task, preview_id)

    refine_payload = {
        "mode": "refine",
        "preview_task_id": preview_id,
        "ai_model": args.ai_model,
        "enable_pbr": bool(args.enable_pbr),
        "moderation": False,
    }
    if args.texture_prompt.strip():
        refine_payload["texture_prompt"] = args.texture_prompt.strip()

    refine_id = client.create_text_to_3d_refine(refine_payload)
    refine = wait_for_task(client.get_text_to_3d_task, refine_id)

    rig_id = client.create_rigging({"input_task_id": refine_id})
    rig = wait_for_task(client.get_rigging_task, rig_id)

    animation_id = client.create_animation(
        {
            "rig_task_id": rig_id,
            "action_id": int(args.action_id),
        }
    )
    animation = wait_for_task(client.get_animation_task, animation_id)

    output = {
        "preview_task_id": preview_id,
        "refine_task_id": refine_id,
        "rig_task_id": rig_id,
        "animation_task_id": animation_id,
        "preview_model_urls": preview.get("model_urls", {}),
        "refined_model_urls": refine.get("model_urls", {}),
        "rig_result": rig.get("result", {}),
        "animation_result": animation.get("result", {}),
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
