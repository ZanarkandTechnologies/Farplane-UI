#!/usr/bin/env python3
"""Minimal Meshy API client for office asset workflows."""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional


class MeshyClient:
    def __init__(self, api_key: Optional[str] = None, timeout_sec: int = 60) -> None:
        self.api_key = api_key or os.getenv("MESHY_API_KEY")
        if not self.api_key:
            raise RuntimeError("MESHY_API_KEY is required")
        self.timeout_sec = timeout_sec
        self.base_v1 = "https://api.meshy.ai/openapi/v1"
        self.base_v2 = "https://api.meshy.ai/openapi/v2"

    def _request(self, method: str, url: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        data = None
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url=url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_sec) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"HTTP {exc.code} calling {url}: {detail}") from exc

    def get_balance(self) -> Dict[str, Any]:
        return self._request("GET", f"{self.base_v1}/balance")

    def create_text_to_3d_preview(self, payload: Dict[str, Any]) -> str:
        response = self._request("POST", f"{self.base_v2}/text-to-3d", payload)
        return str(response["result"])

    def create_text_to_3d_refine(self, payload: Dict[str, Any]) -> str:
        response = self._request("POST", f"{self.base_v2}/text-to-3d", payload)
        return str(response["result"])

    def get_text_to_3d_task(self, task_id: str) -> Dict[str, Any]:
        return self._request("GET", f"{self.base_v2}/text-to-3d/{task_id}")

    def create_image_to_3d(self, payload: Dict[str, Any]) -> str:
        response = self._request("POST", f"{self.base_v1}/image-to-3d", payload)
        return str(response["result"])

    def get_image_to_3d_task(self, task_id: str) -> Dict[str, Any]:
        return self._request("GET", f"{self.base_v1}/image-to-3d/{task_id}")

    def create_multi_image_to_3d(self, payload: Dict[str, Any]) -> str:
        response = self._request("POST", f"{self.base_v1}/multi-image-to-3d", payload)
        return str(response["result"])

    def get_multi_image_to_3d_task(self, task_id: str) -> Dict[str, Any]:
        return self._request("GET", f"{self.base_v1}/multi-image-to-3d/{task_id}")

    def create_remesh(self, payload: Dict[str, Any]) -> str:
        response = self._request("POST", f"{self.base_v1}/remesh", payload)
        return str(response["result"])

    def get_remesh_task(self, task_id: str) -> Dict[str, Any]:
        return self._request("GET", f"{self.base_v1}/remesh/{task_id}")

    def create_rigging(self, payload: Dict[str, Any]) -> str:
        response = self._request("POST", f"{self.base_v1}/rigging", payload)
        return str(response["result"])

    def get_rigging_task(self, task_id: str) -> Dict[str, Any]:
        return self._request("GET", f"{self.base_v1}/rigging/{task_id}")

    def create_animation(self, payload: Dict[str, Any]) -> str:
        response = self._request("POST", f"{self.base_v1}/animations", payload)
        return str(response["result"])

    def get_animation_task(self, task_id: str) -> Dict[str, Any]:
        return self._request("GET", f"{self.base_v1}/animations/{task_id}")

    def create_retexture(self, payload: Dict[str, Any]) -> str:
        response = self._request("POST", f"{self.base_v1}/retexture", payload)
        return str(response["result"])

    def get_retexture_task(self, task_id: str) -> Dict[str, Any]:
        return self._request("GET", f"{self.base_v1}/retexture/{task_id}")


def wait_for_task(
    getter_fn,
    task_id: str,
    poll_sec: float = 4.0,
    timeout_sec: int = 900,
) -> Dict[str, Any]:
    start = time.time()
    while True:
        payload = getter_fn(task_id)
        status = str(payload.get("status", "UNKNOWN"))
        progress = payload.get("progress")
        print(f"[{task_id}] status={status} progress={progress}")
        if status == "SUCCEEDED":
            return payload
        if status in {"FAILED", "CANCELED"}:
            raise RuntimeError(f"Task {task_id} ended in status={status}: {payload.get('task_error')}")
        if time.time() - start > timeout_sec:
            raise TimeoutError(f"Timed out waiting for task {task_id}")
        time.sleep(poll_sec)
