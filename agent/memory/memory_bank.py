from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class MemoryBank:
    storage_path: str
    events: List[Dict[str, Any]] = field(default_factory=list)

    def __post_init__(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    self.events = json.load(f)
            except Exception:  # noqa: BLE001
                self.events = []

    def append_event(self, event: Dict[str, Any]) -> None:
        self.events.append(event)
        self._persist()

    def get_recent(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.events[-limit:]

    def _persist(self):
        try:
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(self.events, f, indent=2)
        except Exception:
            # Don't crash agents if disk write fails
            pass
