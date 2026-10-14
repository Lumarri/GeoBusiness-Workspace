import time
from collections import OrderedDict, deque


class RateLimiter:
    """Per-process, per-IP sliding window. Never trust arbitrary X-Forwarded-For."""

    def __init__(self, limit: int, max_clients: int = 5000):
        self.limit, self.max_clients = limit, max_clients
        self.clients: OrderedDict[str, deque[float]] = OrderedDict()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        while self.clients:
            first_key = next(iter(self.clients))
            if self.clients[first_key] and self.clients[first_key][-1] > now - 60:
                break
            self.clients.popitem(last=False)
        # Refuse new keys at capacity instead of evicting active rate limits.
        if key not in self.clients and len(self.clients) >= self.max_clients:
            return False
        history = self.clients.setdefault(key, deque())
        self.clients.move_to_end(key)
        while history and history[0] <= now - 60:
            history.popleft()
        if len(history) >= self.limit:
            return False
        history.append(now)
        return True
