import datetime

from celery import shared_task

from app.core.database import SessionLocal
from app.repositories.inflation_repository import InflationRepository
from app.services.inflation_service import fetch_current_inflation


@shared_task
def update_inflation_task():
    session = SessionLocal()
    repo = InflationRepository()
    try:
        date, value = fetch_current_inflation()
        repo.add(session, date, value)
        print(f"Инфляция обновлена: {value}% ({date})")
    except Exception as e:
        print(f"Ошибка при обновлении инфляции: {e}")
        prev = repo.get_latest(session)
        if prev:
            repo.add(session, datetime.date.today(), prev.value)
            print(f"Использовано предыдущее значение: {prev.value}% ({prev.date})")
        else:
            print("Нет данных об инфляции — нечего подставлять.")
    finally:
        session.close()
