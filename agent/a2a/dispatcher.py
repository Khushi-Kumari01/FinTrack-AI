from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Callable

from .envelope_schema import Envelope


@dataclass
class Dispatcher:
    handlers: Dict[str, Callable[[Envelope], None]]

    def dispatch(self, envelope: Envelope):
        handler = self.handlers.get(envelope.receiver)
        if handler:
            handler(envelope)
