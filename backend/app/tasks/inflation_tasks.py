import datetime

from celery import shared_task
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.repositories.inflation_repository import InflationRepository
from app.services.inflation_service import fetch_current_inflation


@shared_task
def update_inflation_task():
    session: Session = SessionLocal()
    repo = InflationRepository()
    try:
        # Пытаемся получить данные инфляции
        date, value = fetch_current_inflation()

        # Проверяем, есть ли уже данные за эту дату
        existing = repo.get_latest(session)
        if existing and existing.date == date:
            print(f"Инфляция за {date} уже обновлена: {existing.value}%")
            return {"status": "skipped", "message": f"Already updated for {date}"}

        # Добавляем новые данные
        repo.add(session, date, value)
        session.commit()
        print(f"✅ Инфляция обновлена: {value}% ({date})")
        return {"status": "success", "message": f"Inflation updated: {value}%"}

    except Exception as e:
        session.rollback()
        print(f"❌ Ошибка при обновлении инфляции: {e}")

        # Fallback: используем предыдущее значение
        prev = repo.get_latest(session)
        if prev:
            today = datetime.date.today()
            # Проверяем, что сегодня еще нет записи
            existing_today = repo.get_latest(session)
            if not existing_today or existing_today.date != today:
                repo.add(session, today, prev.value)
                session.commit()
                print(
                    f"🔄 Использовано предыдущее значение: {prev.value}% ({prev.date})"
                )
                return {
                    "status": "fallback",
                    "message": f"Used previous value: {prev.value}%",
                }

        print("⚠️ Нет данных об инфляции — нечего подставлять.")
        return {"status": "error", "message": str(e)}

    finally:
        session.close()
