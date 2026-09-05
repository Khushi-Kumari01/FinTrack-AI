from __future__ import annotations

import sys
from dataclasses import dataclass
from typing import Any, Dict

from .llm_agent import BaseAgent
from tools.bank_tool import BankTool
from tools.scheduler_tool import SchedulerTool


@dataclass
class ExecutorAgent(BaseAgent):
    bank_tool: BankTool
    scheduler_tool: SchedulerTool

    def execute_actions(self, analysis: Dict[str, Any]) -> None:
        """
        Take actions based on analyzer output.

        - If a savings plan was produced, schedule a recurring review reminder.
        - If anomalies were detected, log an alert via telemetry.
        - Always records the execution event to memory.
        """
        goal = analysis.get("goal", "")
        savings = analysis.get("savings_plan")
        anomalies = analysis.get("anomalies")
        insights = analysis.get("insights")

        if savings:
            self.scheduler_tool.schedule_recurring_task(
                name="review_savings_plan",
                cron="0 9 * * MON",
                payload={"savings_plan": savings},
            )
            sys.stdout.write("[EXECUTOR] Scheduled weekly savings plan review.\n")
            sys.stdout.flush()

        if anomalies:
            self.scheduler_tool.log_alert(
                title="Potential anomalies detected",
                payload={"anomalies": anomalies},
            )
            sys.stdout.write(f"[EXECUTOR] Logged anomaly alert: {len(anomalies)} items.\n")
            sys.stdout.flush()

        if insights:
            sys.stdout.write(f"[EXECUTOR] Insights processed for goal: {goal}\n")
            sys.stdout.flush()

        self.record(
            "executor.actions_executed",
            {
                "goal": goal,
                "has_savings": bool(savings),
                "has_anomalies": bool(anomalies),
                "has_insights": bool(insights),
            },
        )
