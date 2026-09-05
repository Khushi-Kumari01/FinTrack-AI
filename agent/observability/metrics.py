# Placeholder. Hook Prometheus / StatsD here in future.

class Metrics:
    def inc(self, name: str, **labels):
        pass

    def observe(self, name: str, value: float, **labels):
        pass
