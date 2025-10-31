# repositories/asset_repository.py
from typing import List, Optional

from app.models.asset import Asset
from app.services.moex_service import safe_float_convert
from sqlalchemy.orm import Session


class AssetRepository:
    def get_all_assets(self, db_session: Session) -> List[Asset]:
        """Получить все активы из БД"""
        return db_session.query(Asset).all()

    def get_assets_by_type(self, db_session: Session, asset_type: str) -> List[Asset]:
        """Получить активы по типу"""
        if asset_type.lower() == "облигация":
            result = (
                db_session.query(Asset)
                .filter(Asset.type.ilike(f"%{asset_type}%"))
                .all()
            )
        else:
            result = db_session.query(Asset).filter(Asset.type == asset_type).all()

        return result

    def get_asset_by_ticker(self, db_session: Session, ticker: str) -> Optional[Asset]:
        """Получить актив по тикеру"""
        return db_session.query(Asset).filter(Asset.ticker == ticker).first()

    def get_assets_by_tickers(
        self, db_session: Session, tickers: List[str]
    ) -> List[Asset]:
        """Получить активы по списку тикеров"""
        return db_session.query(Asset).filter(Asset.ticker.in_(tickers)).all()

    def add_or_update_many(self, session: Session, assets_data: list[dict]):
        """Безопасное обновление с сохранением данных при ошибках"""

        existing_assets = session.query(Asset).all()
        existing_dict = {
            asset.ticker: asset for asset in existing_assets
        }  # Теперь по тикеру

        successful_updates = []

        for asset_data in assets_data:
            ticker = asset_data["ticker"]

            if ticker in existing_dict:
                existing_asset = existing_dict[ticker]
                self._apply_fallback_prices(asset_data, existing_asset)

            if not self._is_valid_asset_data(asset_data):
                continue

            if ticker in existing_dict:
                asset = existing_dict[ticker]
                if self._has_significant_changes(asset, asset_data):
                    for key, value in asset_data.items():
                        setattr(asset, key, value)
                    successful_updates.append(ticker)

            else:
                session.add(Asset(**asset_data))
                successful_updates.append(ticker)

        session.commit()

    def _apply_fallback_prices(self, asset_data: dict, existing_asset: Asset):
        """Применяет fallback логику: если новые данные = 0, используем старые"""

        new_price_now = safe_float_convert(asset_data["price_now"])
        existing_price_now = safe_float_convert(existing_asset.price_now)

        if new_price_now <= 0 and existing_price_now > 0:
            print(
                f"[FALLBACK] {asset_data['name']}: цена сейчас = 0, "
                f"используем старую = {existing_price_now}"
            )
            asset_data["price_now"] = existing_price_now

        new_price_old = safe_float_convert(asset_data["price_old"])
        existing_price_old = safe_float_convert(existing_asset.price_old)

        if new_price_old <= 0 and existing_price_old > 0:
            print(
                f"[FALLBACK] {asset_data['name']}: историческая цена = 0, "
                f"используем старую = {existing_price_old}"
            )
            asset_data["price_old"] = existing_price_old

        new_yield = safe_float_convert(asset_data["yield_value"])
        existing_yield = safe_float_convert(existing_asset.yield_value)

        if new_yield <= 0 and existing_yield > 0:
            asset_data["yield_value"] = existing_yield

        new_volatility = safe_float_convert(asset_data["volatility"])
        existing_volatility = safe_float_convert(existing_asset.volatility)

        if new_volatility <= 0 and existing_volatility > 0:
            asset_data["volatility"] = existing_volatility

    def _is_valid_asset_data(self, asset_data: dict) -> bool:
        """Проверяет валидность данных актива после применения fallback"""
        required_fields = [
            "name",
            "ticker",
            "type",
            "price_old",
            "price_now",
            "yield_value",
            "volatility",
        ]

        for field in required_fields:
            if field not in asset_data:
                print(f"[VALIDATION] Отсутствует поле: {field}")
                return False

        if not asset_data["name"] or not asset_data["ticker"] or not asset_data["type"]:
            print(
                f"[VALIDATION] Пустое имя, тикер или тип: {asset_data['name']}, "
                f"{asset_data['ticker']}, {asset_data['type']}"
            )
            return False

        price_now = safe_float_convert(asset_data["price_now"])
        price_old = safe_float_convert(asset_data["price_old"])

        if price_now <= 0 or price_old <= 0:
            return False

        return True

    def _has_significant_changes(self, existing_asset: Asset, new_data: dict) -> bool:
        """Проверяет, есть ли значимые изменения в данных"""
        tolerance = 0.001

        current_price_changed = (
            abs(
                safe_float_convert(existing_asset.price_now)
                - safe_float_convert(new_data["price_now"])
            )
            > tolerance
        )

        old_price_changed = (
            abs(
                safe_float_convert(existing_asset.price_old)
                - safe_float_convert(new_data["price_old"])
            )
            > tolerance
        )

        yield_changed = (
            abs(
                safe_float_convert(existing_asset.yield_value)
                - safe_float_convert(new_data["yield_value"])
            )
            > tolerance
        )

        volatility_changed = (
            abs(
                safe_float_convert(existing_asset.volatility)
                - safe_float_convert(new_data["volatility"])
            )
            > tolerance
        )

        has_changes = (
            current_price_changed
            or old_price_changed
            or yield_changed
            or volatility_changed
        )

        return has_changes
