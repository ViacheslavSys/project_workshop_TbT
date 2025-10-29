from celery import shared_task

from app.core.database import SessionLocal
from app.repositories.asset_repository import AssetRepository
from app.services.moex_service import fetch_asset_data


@shared_task
def update_assets_task():
    session = SessionLocal()
    repo = AssetRepository()

    tickers = [
        {"ticker": "SBER", "type": "акция"},
        {"ticker": "TCSG", "type": "акция"},
        {"ticker": "GAZP", "type": "акция"},
    ]

    try:
        assets_data = []

        for t in tickers:
            data = fetch_asset_data(t["ticker"], t["type"])
            assets_data.append(data)

        repo.add_or_update_many(session, assets_data)

    except Exception as e:
        print(f"Ошибка при обновлении активов: {e}")
        session.rollback()
    finally:
        session.close()
