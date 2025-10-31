import json
import os
from typing import Optional

import redis


class RedisCache:
    def __init__(self):
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.ttl = int(os.getenv("REDIS_TTL", 3600))
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

    def set_list(self, key: str, value: list, expire: Optional[int] = None):
        """Сохраняет список в Redis"""
        expire = expire or self.ttl
        if self.enabled:
            self.client.delete(key)
            if value:
                self.client.rpush(key, *[json.dumps(item) for item in value])
                self.client.expire(key, expire)
        else:
            self._memory[key] = value

    def get_list(self, key: str) -> list:
        """Получает список из Redis"""
        if self.enabled:
            data = self.client.lrange(key, 0, -1)
            return [json.loads(item) for item in data] if data else []
        return self._memory.get(key, [])

    def append_to_list(self, key: str, value: dict, expire: Optional[int] = None):
        """Добавляет элемент в список"""
        expire = expire or self.ttl
        if self.enabled:
            self.client.rpush(key, json.dumps(value))
            self.client.expire(key, expire)
        else:
            if key not in self._memory:
                self._memory[key] = []
            self._memory[key].append(value)


cache = RedisCache()
