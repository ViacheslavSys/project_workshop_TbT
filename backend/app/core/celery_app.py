import os

from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "background_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.inflation_tasks", "app.tasks.moex_tasks"],
)


celery_app.conf.beat_schedule = {
    "update-inflation-weekly": {
        "task": "app.tasks.inflation_tasks.update_inflation_task",
        "schedule": crontab(hour=22, minute=0, day_of_week=5),
    },
    "update-moex-weekly": {
        "task": "app.tasks.moex_tasks.update_assets_task",
        "schedule": crontab(),  # hour=22, minute=0, day_of_week=5),
    },
}

celery_app.conf.timezone = "Europe/Moscow"
