from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Callable, Dict, List

from agents.planner_agent import PlannerAgent
from agents.analyzer_agent import AnalyzerAgent
from agents.executor_agent import ExecutorAgent
from observability.telemetry import Telemetry


@dataclass
class ParallelAgentPool:
    planner: PlannerAgent
    analyzer: AnalyzerAgent
    executor: ExecutorAgent
    max_workers: int
    telemetry: Telemetry
    executor_pool: ThreadPoolExecutor = field(init=False)

    def __post_init__(self):
        self.executor_pool = ThreadPoolExecutor(max_workers=self.max_workers)

    def submit_goal(self, goal: str):
        self.telemetry.event("pool.submit_goal", goal=goal)

        def _pipeline():
            plan = self.planner.plan(goal)
            analysis = self.analyzer.analyze_plan(plan)
            self.executor.execute_actions(analysis)

        self.executor_pool.submit(_pipeline)

    def run_periodic_tasks(self):
        """
        Called by MonitorLoopAgent.
        Example: re-run insights for last 30 days automatically.
        """
        self.submit_goal("Refresh spending insights for the last 30 days")
