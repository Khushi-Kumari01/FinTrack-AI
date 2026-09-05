from __future__ import annotations

import json
import os
from dataclasses import dataclass

from agent_main import build_runtime  # reuse runtime builder


@dataclass
class ScenarioResult:
    name: str
    success: bool
    details: str


def run_scenario(runtime, scenario_path: str) -> ScenarioResult:
    with open(scenario_path, "r", encoding="utf-8") as f:
        scenario = json.load(f)

    goal = scenario["goal"]
    expected = scenario.get("expected", {})

    planner = runtime["planner"]
    analyzer = runtime["analyzer"]

    plan = planner.plan(goal)
    analysis = analyzer.analyze_plan(plan)

    success = True
    details = ""

    if expected.get("hasSavingsPlan") and not analysis.get("savings_plan"):
        success = False
        details += "Expected savings_plan but none.\n"

    if expected.get("hasBudget") and not analysis.get("budget"):
        success = False
        details += "Expected budget but none.\n"

    if expected.get("hasAnomaliesCheck") and analysis.get("anomalies") is None:
        success = False
        details += "Expected anomalies check but none.\n"

    return ScenarioResult(name=os.path.basename(scenario_path), success=success, details=details)
