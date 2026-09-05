from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from .llm_agent import BaseAgent
from tools.bank_tool import BankTool
from tools.scheduler_tool import SchedulerTool
from tools.receipt_tool import ReceiptTool


@dataclass
class PlannerAgent(BaseAgent):
    bank_tool: BankTool
    scheduler_tool: SchedulerTool
    receipt_tool: ReceiptTool

    def plan(self, goal: str) -> Dict[str, Any]:
        """
        Produce a high-level plan for a financial goal.

        Example goals:
          - "Optimize my monthly expenses"
          - "Detect unusual spending in last 30 days"
          - "Prepare a budget for next month"
        """

        # Very simple rule-based planner (you can later replace with LLM planner)
        steps: List[Dict[str, Any]] = []

        goal_lower = goal.lower()
        if "optimize" in goal_lower or "save" in goal_lower:
            steps.extend(
                [
                    {"action": "fetch_transactions", "window_days": 30},
                    {"action": "get_insights"},
                    {"action": "propose_savings_plan"},
                ]
            )
        elif "anomaly" in goal_lower or "unusual" in goal_lower:
            steps.extend(
                [
                    {"action": "fetch_transactions", "window_days": 30},
                    {"action": "detect_anomalies"},
                ]
            )
        elif "budget" in goal_lower:
            steps.extend(
                [
                    {"action": "fetch_transactions", "window_days": 60},
                    {"action": "derive_budget"},
                ]
            )
        else:
            steps.append({"action": "get_insights"})

        plan = {"goal": goal, "steps": steps}
        self.record("planner.plan_created", {"goal": goal, "steps": steps})
        return plan
