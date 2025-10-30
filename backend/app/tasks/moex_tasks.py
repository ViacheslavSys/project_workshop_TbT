from celery import shared_task

from app.core.database import SessionLocal
from app.repositories.asset_repository import AssetRepository
from app.services.moex_service import fetch_asset_data_batch


@shared_task
def update_assets_task():
    """Задача для обновления всех активов в БД (оптимизированная версия)"""
    session = SessionLocal()
    repo = AssetRepository()

    # Список всех активов
    tickers = [
        ("SBER", "акция"),
        ("GAZP", "акция"),
        ("LKOH", "акция"),
        ("GMKN", "акция"),
        ("ROSN", "акция"),
        ("MGNT", "акция"),
        ("TCSG", "акция"),
        ("VTBR", "акция"),
        ("TATN", "акция"),
        ("NLMK", "акция"),
        ("SU26207RMFS9", "облигация среднесрочная"),
        ("SU26212RMFS9", "облигация среднесрочная"),
        ("SU26218RMFS6", "облигация долгосрочная"),
        ("SU26219RMFS4", "облигация краткосрочная"),
        ("SU26221RMFS0", "облигация долгосрочная"),
        ("SU26226RMFS9", "облигация краткосрочная"),
        ("RU000A0JX0J6", "облигация среднесрочная"),
        ("RU000A0ZYKW1", "облигация долгосрочная"),
        ("TGLD", "золото"),
        ("GOLD", "золото"),
        ("RU000A0ERGA7", "недвижимость"),
        ("RU000A0JXP78", "недвижимость"),
        ("RU000A1034U7", "недвижимость"),
        ("RU000A104YX8", "недвижимость"),
    ]

    try:
        # Получить ВСЕ данные и рассчитать ВСЕ показатели за один проход
        assets_data = fetch_asset_data_batch(tickers)

        if assets_data:
            repo.add_or_update_many(session, assets_data)
            print(f"✅ Задача завершена. Обработано {len(assets_data)} активов")
        else:
            print("❌ Не удалось получить данные ни для одного актива")

    except Exception as e:
        print(f"❌ Критическая ошибка в задаче обновления активов: {e}")
        session.rollback()
    finally:
        session.close()
