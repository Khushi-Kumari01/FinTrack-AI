from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from agents.parallel_agent_pool import ParallelAgentPool
from observability.telemetry import Telemetry


@dataclass
class MonitorLoopAgent:
    pool: ParallelAgentPool
    telemetry: Telemetry
    interval_seconds: int = 60

    _thread: threading.Thread | None = None
    _stop_event: threading.Event | None = None

    def _loop(self):
        self.telemetry.event("monitor.start")
        while self._stop_event and not self._stop_event.is_set():
            try:
                self.telemetry.event("monitor.tick")
                self.pool.run_periodic_tasks()
            except Exception as exc:  # noqa: BLE001
                self.telemetry.error("monitor.error", error=str(exc))
            time.sleep(self.interval_seconds)
        self.telemetry.event("monitor.stop")

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        import threading as _t

        self._stop_event = _t.Event()
        self._thread = _t.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        if self._stop_event:
            self._stop_event.set()
