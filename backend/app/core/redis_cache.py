import redis
import json
import os
from typing import Optional


class RedisCache:
    def __init__(self):
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.ttl = int(os.getenv("REDIS_TTL", 3600))  # время жизни по умолчанию 1 час
        try:
            self.client = redis.Redis.from_url(url, decode_responses=True)
            self.client.ping()
            print(f"✅ Подключен к Redis: {url}")
            self.enabled = True
        except Exception as e:
            print(f"⚠️ Redis не доступен ({e}), используется in-memory режим.")
            self.enabled = False
            self._memory = {}

    def set_json(self, key: str, value: dict, expire: Optional[int] = None):
        expire = expire or self.ttl
        if self.enabled:
            self.client.set(key, json.dumps(value), ex=expire)
        else:
            self._memory[key] = value

    def get_json(self, key: str) -> Optional[dict]:
        if self.enabled:
            data = self.client.get(key)
            return json.loads(data) if data else None
        return self._memory.get(key)
