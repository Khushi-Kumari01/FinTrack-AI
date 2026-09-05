# agent_main.py
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv
load_dotenv()

# Fix import paths when running locally
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

# === Local imports ===
from agents.planner_agent import PlannerAgent
from agents.analyzer_agent import AnalyzerAgent
from agents.executor_agent import ExecutorAgent
from agents.monitor_loop_agent import MonitorLoopAgent
from agents.parallel_agent_pool import ParallelAgentPool

from sessions.in_memory_session import InMemorySession
from memory.memory_bank import MemoryBank

from observability.logging_config import configure_logging
from observability.telemetry import Telemetry

from tools.bank_tool import BankTool
from tools.scheduler_tool import SchedulerTool
from tools.receipt_tool import ReceiptTool

# Load backend URL
BACKEND_BASE_URL = os.getenv("FINTRACK_BACKEND_URL", "http://localhost:5000/api")


# ============================
# BUILD RUNTIME
# ============================
def build_runtime():
    """
    Initializes all shared objects used by agents.
    """
    if not os.getenv("FINTRACK_AGENT_USER_TOKEN", "").strip():
        raise RuntimeError(
            "FINTRACK_AGENT_USER_TOKEN is required. Log in to FinTrack and set "
            "the resulting JWT in the environment before running the evaluator."
        )

    logger = configure_logging()
    telemetry = Telemetry(logger=logger)

    session = InMemorySession()
    memory = MemoryBank(storage_path=os.path.join(CURRENT_DIR, "memory_store.json"))

    # Tools with backend support
    bank_tool = BankTool(base_url=BACKEND_BASE_URL, telemetry=telemetry)
    scheduler_tool = SchedulerTool(telemetry=telemetry)
    receipt_tool = ReceiptTool(base_url=BACKEND_BASE_URL, telemetry=telemetry)

    planner = PlannerAgent(
        session=session,
        memory=memory,
        telemetry=telemetry,
        bank_tool=bank_tool,
        scheduler_tool=scheduler_tool,
        receipt_tool=receipt_tool,
    )

    analyzer = AnalyzerAgent(
        session=session,
        memory=memory,
        telemetry=telemetry,
        bank_tool=bank_tool,
    )

    executor = ExecutorAgent(
        session=session,
        memory=memory,
        telemetry=telemetry,
        bank_tool=bank_tool,
        scheduler_tool=scheduler_tool,
    )

    pool = ParallelAgentPool(
        planner=planner,
        analyzer=analyzer,
        executor=executor,
        max_workers=4,
        telemetry=telemetry,
    )

    monitor = MonitorLoopAgent(
        pool=pool,
        telemetry=telemetry,
        interval_seconds=60,  # Run monitor loop every 1 minute
    )

    return {
        "logger": logger,
        "telemetry": telemetry,
        "session": session,
        "memory": memory,
        "planner": planner,
        "analyzer": analyzer,
        "executor": executor,
        "pool": pool,
        "monitor": monitor,
    }


# ============================
# INTERACTIVE MODE
# ============================
def run_interactive(runtime):
    """
    Console interface for giving natural-language commands to the planner agent.
    """
    planner = runtime["planner"]
    analyzer = runtime["analyzer"]
    executor = runtime["executor"]
    logger = runtime["logger"]

    logger.info("FinTrack multi-agent console. Type a goal or 'exit'.")

    while True:
        goal = input("\n💡 Goal> ").strip()
        if goal.lower() in {"exit", "quit"}:
            logger.info("Exiting multi-agent console.")
            break

        plan = planner.plan(goal)
        analysis = analyzer.analyze_plan(plan)
        executor.execute_actions(analysis)


# ============================
# AUTONOMOUS BACKGROUND MODE
# ============================
def run_autonomous(runtime):
    """
    Automatic background monitoring mode.
    """
    monitor = runtime["monitor"]
    runtime["logger"].info("Starting autonomous monitor loop…")
    monitor.start()

    try:
        while True:
            time.sleep(5)
    except KeyboardInterrupt:
        runtime["logger"].info("Stopping monitor loop…")
        monitor.stop()


# ============================
# MAIN
# ============================

def main():
    runtime = build_runtime()

    import argparse

    parser = argparse.ArgumentParser(description="FinTrack Multi-Agent System")
    parser.add_argument("--goal", type=str, help="Run a single agent goal and exit")
    parser.add_argument("--mode", choices=["interactive", "autonomous"], default="interactive")
    args = parser.parse_args()

    if args.goal:
        planner = runtime["planner"]
        analyzer = runtime["analyzer"]
        executor = runtime["executor"]

        plan = planner.plan(args.goal)
        analysis = analyzer.analyze_plan(plan)
        executor.execute_actions(analysis)
        runtime["logger"].info("Agent pipeline completed")
        return

    if args.mode == "autonomous":
        run_autonomous(runtime)
    else:
        print("""
FinTrack Multi-Agent System:
 1) Interactive mode (chat with agents)
 2) Autonomous mode (background monitoring)
""")
        choice = input("Choose mode (1/2): ").strip()

        if choice == "2":
            run_autonomous(runtime)
        else:
            run_interactive(runtime)


if __name__ == "__main__":
    main()
