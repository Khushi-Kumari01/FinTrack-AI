from __future__ import annotations

import random
import sys
from dataclasses import dataclass
from typing import Any, Dict, List

from .llm_agent import BaseAgent
from tools.bank_tool import BankTool


@dataclass
class AnalyzerAgent(BaseAgent):
    bank_tool: BankTool

    def analyze_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """Execute analysis steps produced by the PlannerAgent."""
        goal = plan.get("goal", "")
        steps: List[Dict[str, Any]] = plan.get("steps", [])

        transactions = None
        insights = None
        roast_message = None
        badges: List[str] = []
        savings_plan = None
        budget = None
        anomalies = None

        for step in steps:
            action = step["action"]

            if action == "fetch_transactions":
                window_days = step.get("window_days", 30)
                transactions = self.bank_tool.get_recent_transactions(window_days)

            elif action == "get_insights":
                insights = self.bank_tool.get_insights()

            elif action == "roast_user":
                roast_message = self.generate_roast(transactions or [])

            elif action == "calculate_badges":
                badges = self.calculate_gamification(transactions or [])

            elif action in ("propose_savings_plan", "detect_anomalies", "derive_budget"):
                if transactions is None:
                    transactions = self.bank_tool.get_recent_transactions()
                if action == "propose_savings_plan":
                    savings_plan = self.bank_tool.propose_savings_plan(transactions)
                elif action == "detect_anomalies":
                    anomalies = self.bank_tool.detect_anomalies(transactions)
                else:
                    budget = self.bank_tool.derive_budget(transactions)

            # Use sys.stdout.write to avoid Windows cp1252 emoji encoding errors
            sys.stdout.write(f"[AGENT] action={action}\n")
            sys.stdout.flush()

        analysis = {
            "goal": goal,
            "transactions": transactions,
            "insights": insights,
            "roast": roast_message,
            "badges": badges,
            "savings_plan": savings_plan,
            "budget": budget,
            "anomalies": anomalies,
        }

        self.record("analyzer.analysis_completed", {"goal": goal})
        return analysis

    def generate_roast(self, transactions: List[Dict]) -> str:
        """Generate a data-driven spending comment."""
        if not transactions:
            return "No transactions found yet — add some expenses to get a roast."

        try:
            food_spend = sum(
                float(t.get("amount", 0)) for t in transactions
                if str(t.get("category", "")).lower() in ("food & dining", "food", "dining")
            )
            total_spend = sum(float(t.get("amount", 0)) for t in transactions)
        except (TypeError, ValueError):
            total_spend = 0
            food_spend = 0

        if total_spend > 0 and total_spend > 0 and (food_spend / total_spend) > 0.4:
            pct = int((food_spend / total_spend) * 100)
            return f"You spent {pct}% of your money on food. Do you own stock in Zomato or what?"

        roasts = [
            f"Total spend: Rs {total_spend:.0f}. Your wallet is on a diet whether you are or not.",
            "Your financial strategy seems to be 'YOLO' and it shows.",
            "I've seen better budgeting from a raccoon.",
            "Stop buying things you don't need to impress people you don't like.",
        ]
        return random.choice(roasts)

    def calculate_gamification(self, transactions: List[Dict]) -> List[str]:
        """Award badges based on spending behaviour."""
        if not transactions:
            return ["Ghost Spender"]

        try:
            total_spend = sum(float(t.get("amount", 0)) for t in transactions)
        except (TypeError, ValueError):
            total_spend = 0

        badges: List[str] = []
        if total_spend < 5000:
            badges.append("Monk Mode")
        if any(float(t.get("amount", 0)) > 10000 for t in transactions):
            badges.append("High Roller")
        if len(transactions) > 10:
            badges.append("Power User")

        return badges if badges else ["Starter"]
