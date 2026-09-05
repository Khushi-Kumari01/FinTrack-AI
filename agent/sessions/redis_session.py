# Placeholder; you can wire redis-py here if you want later.

class RedisSession:
    def __init__(self, *_, **__):
        raise NotImplementedError(
            "RedisSession is not implemented yet. "
            "Use InMemorySession or implement redis connection here."
        )
