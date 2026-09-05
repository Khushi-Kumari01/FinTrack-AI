from __future__ import annotations
import json
from dataclasses import dataclass
from typing import Any, Dict, Optional
import requests

import os

AUTH_TOKEN = os.getenv("FINTRACK_AGENT_USER_TOKEN")

@dataclass
class MCPClient:
    base_url: str

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if not AUTH_TOKEN:
            raise RuntimeError("Agent missing FINTRACK_AGENT_USER_TOKEN environment variable")

        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}

        resp = requests.request(
            method,
            url,
            params=params,
            json=json_body,
            headers=headers,
            timeout=20
        )
        resp.raise_for_status()

        try:
            return resp.json()
        except json.JSONDecodeError:
            return {"raw": resp.text}

    def get(self, path: str, **kwargs) -> Dict[str, Any]:
        return self._request("GET", path, **kwargs)

    def post(self, path: str, **kwargs) -> Dict[str, Any]:
        return self._request("POST", path, **kwargs)

    def delete(self, path: str, **kwargs) -> Dict[str, Any]:
        return self._request("DELETE", path, **kwargs)
