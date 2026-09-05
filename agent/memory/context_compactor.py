# Placeholder for future context summarization / compression.
# You can plug in backend AIService or a Python LLM later.

class ContextCompactor:
    def compact(self, events, max_items: int = 100):
        return events[-max_items:]
