import os
from datetime import datetime, timedelta, timezone
from statistics import mean, median
import requests

class BankTool:
    def __init__(self, base_url="http://localhost:5000/api", telemetry=None):
        # NOTE: base_url points to your Node.js Backend
        self.base_url = base_url
        self.telemetry = telemetry
        self.token = os.getenv("FINTRACK_AGENT_USER_TOKEN")

    def _headers(self):
        if not self.token:
            raise RuntimeError("Agent missing FINTRACK_AGENT_USER_TOKEN environment variable")
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def get_insights(self):
        try:
            url = f"{self.base_url}/insights"
            headers = self._headers()

            resp = requests.get(url, headers=headers)
            resp.raise_for_status()
            return resp.json()

        except RuntimeError:
            raise
        except Exception as e:
            print(f"BankTool Error: {str(e)}")
            return None

    # Adding missing methods referenced in analyzer_agent.py
    def get_recent_transactions(self, days=30):
        try:
            url = f"{self.base_url}/transactions"
            end = datetime.now(timezone.utc)
            start = end - timedelta(days=days)
            resp = requests.get(
                url,
                headers=self._headers(),
                params={"from": start.isoformat(), "to": end.isoformat(), "limit": 500},
                timeout=20,
            )
            resp.raise_for_status()
            return resp.json()
        except RuntimeError:
            raise
        except Exception as e:
            print(f"BankTool Error: {str(e)}")
            raise RuntimeError(f"Unable to fetch transactions from FinTrack: {e}") from e

    def derive_budget(self, transactions=None):
        transactions = transactions or []
        expenses = [t for t in transactions if str(t.get("type", "expense")).lower() != "income"]
        if not expenses:
            return {}

        categories = {}
        for transaction in expenses:
            category = str(transaction.get("category") or "Uncategorized")
            amount = float(transaction.get("amount") or 0)
            if amount > 0:
                categories[category] = categories.get(category, 0) + amount

        return {category: round(amount) for category, amount in categories.items()}

    def propose_savings_plan(self, transactions=None):
        transactions = transactions or []
        income = sum(float(t.get("amount") or 0) for t in transactions if t.get("type") == "income")
        expenses = sum(float(t.get("amount") or 0) for t in transactions if t.get("type") != "income")
        surplus = income - expenses
        if income <= 0:
            return None

        target_rate = 0.20 if surplus > 0 else 0.10
        target = round(income * target_rate)
        return {
            "monthly_income": round(income),
            "monthly_expenses": round(expenses),
            "recommended_monthly_saving": target,
            "savings_rate": round(target_rate * 100),
            "message": f"Set aside Rs {target} per month based on your recorded income and spending.",
        }

    def detect_anomalies(self, transactions=None):
        transactions = transactions or []
        amounts = [float(t.get("amount") or 0) for t in transactions if float(t.get("amount") or 0) > 0]
        if len(amounts) < 3:
            return []

        baseline = median(amounts)
        average = mean(amounts)
        threshold = max(average + (2 * (average - baseline)), baseline * 3)
        return [
            {
                "merchant": t.get("merchant") or "Unknown merchant",
                "amount": float(t.get("amount") or 0),
                "category": t.get("category") or "Uncategorized",
                "reason": "Amount is unusually high compared with the available transactions.",
            }
            for t in transactions
            if float(t.get("amount") or 0) > threshold
        ]