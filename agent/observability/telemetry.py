class Telemetry:
    def __init__(self, logger):
        self.logger = logger

    def event(self, name: str, **payload):
        """Record an event with arbitrary metadata."""
        try:
            self.logger.info(f"[EVENT] {name} - {payload}")
        except Exception as e:
            self.logger.error(f"Telemetry error: {e}")
