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
        ("SBER", "акция", "Сбербанк"),
        ("GAZP", "акция", "Газпром"),
        ("LKOH", "акция", "Лукойл"),
        ("GMKN", "акция", "Норникель"),
        ("ROSN", "акция", "Роснефть"),
        ("MGNT", "акция", "Магнит"),
        ("TCSG", "акция", "TCS Group"),
        ("TATN", "акция", "Татнефть"),
        ("NLMK", "акция", "НЛМК"),
        ("SU26207RMFS9", "облигация среднесрочная", "ОФЗ 26207"),
        ("SU26212RMFS9", "облигация среднесрочная", "ОФЗ 26212"),
        ("SU26218RMFS6", "облигация долгосрочная", "ОФЗ 26218"),
        ("SU26219RMFS4", "облигация краткосрочная", "ОФЗ 26219"),
        ("SU26221RMFS0", "облигация долгосрочная", "ОФЗ 26221"),
        ("SU26226RMFS9", "облигация краткосрочная", "ОФЗ 26226"),
        ("TGLD", "золото", "Тинькофф Золото"),
        ("GOLD", "золото", "FinEx Золото"),
        ("RU000A0ERGA7", "недвижимость", "ПИФ Сбер-КН"),
        ("RU000A0JXP78", "недвижимость", "ЗПИФ ДОМ.РФ"),
        ("RU000A1034U7", "недвижимость", "СФН АрБиз7"),
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
