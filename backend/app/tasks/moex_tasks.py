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
        ("SBER", "Акция", "Сбербанк"),
        ("GAZP", "Акция", "Газпром"),
        ("LKOH", "Акция", "Лукойл"),
        ("GMKN", "Акция", "Норникель"),
        ("ROSN", "Акция", "Роснефть"),
        ("MGNT", "Акция", "Магнит"),
        ("TCSG", "Акция", "TCS Group"),
        ("TATN", "Акция", "Татнефть"),
        ("NLMK", "Акция", "НЛМК"),
        ("SU26207RMFS9", "Облигация среднесрочная", "ОФЗ 26207"),
        ("SU26212RMFS9", "Облигация среднесрочная", "ОФЗ 26212"),
        ("SU26218RMFS6", "Облигация долгосрочная", "ОФЗ 26218"),
        ("SU26219RMFS4", "Облигация краткосрочная", "ОФЗ 26219"),
        ("SU26221RMFS0", "Облигация долгосрочная", "ОФЗ 26221"),
        ("SU26226RMFS9", "Облигация краткосрочная", "ОФЗ 26226"),
        # ("TGLD", "Золото", "Тинькофф Золото"),
        ("GOLD", "Золото", "FinEx Золото"),
        ("RU000A0ERGA7", "Недвижимость", "ПИФ Сбер-КН"),
        ("RU000A0JXP78", "Недвижимость", "ЗПИФ ДОМ.РФ"),
        ("RU000A1034U7", "Недвижимость", "СФН АрБиз7"),
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
