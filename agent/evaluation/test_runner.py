from __future__ import annotations

import glob
import os
import sys

# Allow `python evaluation/test_runner.py` from the agent directory.
AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if AGENT_DIR not in sys.path:
    sys.path.insert(0, AGENT_DIR)

from evaluation.evaluator import run_scenario
from agent_main import build_runtime


def main():
    try:
        runtime = build_runtime()
    except RuntimeError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 2
    base_dir = os.path.dirname(os.path.abspath(__file__))
    scenarios_dir = os.path.join(base_dir, "scenarios")

    scenario_files = glob.glob(os.path.join(scenarios_dir, "*.json"))
    results = [run_scenario(runtime, path) for path in scenario_files]

    print("\nEvaluation results:")
    for r in results:
        status = "PASS" if r.success else "FAIL"
        print(f"{status} {r.name}")
        if r.details:
            print("   ", r.details.strip())

    return 0 if all(r.success for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
