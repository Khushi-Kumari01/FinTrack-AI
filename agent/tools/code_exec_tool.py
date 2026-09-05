from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from observability.telemetry import Telemetry


@dataclass
class CodeExecTool:
    telemetry: Telemetry

    def safe_eval(self, expression: str, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        """
        Placeholder for a safe execution environment.
        DO NOT use Python eval in production. This is intentionally minimal.
        """
        self.telemetry.event("tool.code.safe_eval_requested", expression=expression)
        return {"result": None, "error": "Not implemented for safety."}
