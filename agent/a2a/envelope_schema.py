from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class Envelope:
    sender: str
    receiver: str
    kind: str
    payload: Dict[str, Any]
