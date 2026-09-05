from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict


@dataclass
class InMemorySession:
    store: Dict[str, Any] = field(default_factory=dict)

    def get(self, key: str, default=None):
        return self.store.get(key, default)

    def set(self, key: str, value: Any):
        self.store[key] = value
