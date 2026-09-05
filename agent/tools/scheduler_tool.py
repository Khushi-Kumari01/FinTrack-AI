from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict
from observability.telemetry import Telemetry


@dataclass
class SchedulerTool:
    telemetry: Telemetry

    def schedule_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Schedule a one-off task and record the event."""
        self.telemetry.event("tool.scheduler.schedule", task)
        return {"scheduled": True, "task": task}

    def schedule_recurring_task(
        self,
        name: str,
        cron: str,
        payload: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Record a recurring task definition.
        In the current architecture this logs the intent; actual scheduling
        would be wired to a real job runner (e.g. node-cron on the backend).
        """
        task = {"name": name, "cron": cron, "payload": payload or {}}
        self.telemetry.event("tool.scheduler.recurring", task)
        return {"scheduled": True, "recurring": True, "task": task}

    def log_alert(self, title: str, payload: Dict[str, Any] | None = None) -> None:
        """Log an alert event via telemetry."""
        self.telemetry.event("tool.scheduler.alert", {"title": title, "payload": payload or {}})
