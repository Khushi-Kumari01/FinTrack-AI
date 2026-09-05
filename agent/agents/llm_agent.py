from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Protocol


class Session(Protocol):
    def get(self, key: str, default=None): ...
    def set(self, key: str, value: Any): ...


class Memory(Protocol):
    def append_event(self, event: Dict[str, Any]) -> None: ...
    def get_recent(self, limit: int = 50) -> list[Dict[str, Any]]: ...


class Telemetry(Protocol):
    def event(self, name: str, **kwargs): ...
    def error(self, name: str, **kwargs): ...


@dataclass
class BaseAgent:
    session: Session
    memory: Memory
    telemetry: Telemetry

    def record(self, kind: str, payload: Dict[str, Any]):
        event = {"kind": kind, **payload}
        self.memory.append_event(event)
        self.telemetry.event(f"agent.{kind}", **payload)


class LLMDelegate(Protocol):
    def ask(self, prompt: str, context: Optional[str] = None) -> str: ...
