from app.models.asset import Asset


class AssetRepository:

    def add_or_update_many(self, session, assets_data: list[dict]):
        """Безопасное обновление с сохранением данных при ошибках"""

        existing_assets = session.query(Asset).all()
        existing_dict = {asset.name: asset for asset in existing_assets}

        successful_updates = []

        for asset_data in assets_data:
            ticker = asset_data['name']

            if not self._is_valid_asset_data(asset_data):
                continue

            if ticker in existing_dict:
                asset = existing_dict[ticker]
                # Обновляем только если есть значимые изменения в ЦЕНАХ
                if self._has_significant_changes(asset, asset_data):
                    for key, value in asset_data.items():
                        setattr(asset, key, value)
                    successful_updates.append(ticker)

            else:
                session.add(Asset(**asset_data))
                successful_updates.append(ticker)

        session.commit()
        print(f"✅ Успешно обновлено {len(successful_updates)} активов")

    def _is_valid_asset_data(self, asset_data: dict) -> bool:
        """Проверяет валидность данных актива"""
        required_fields = [
            'name',
            'type',
            'price_old',
            'price_now',
            'yield_value',
            'volatility',
        ]

        for field in required_fields:
            if field not in asset_data:
                return False

        if not asset_data['name'] or not asset_data['type']:
            return False

        if asset_data['price_now'] <= 0 or asset_data['price_old'] <= 0:
            return False

        return True

    def _has_significant_changes(self, existing_asset: Asset, new_data: dict) -> bool:
        """Проверяет, есть ли значимые изменения в ЦЕНАХ (текущей и старой)"""
        tolerance = 0.001

        current_price_changed = (
            abs(existing_asset.price_now - new_data['price_now']) > tolerance
        )

        old_price_changed = (
            abs(existing_asset.price_old - new_data['price_old']) > tolerance
        )

        volatility_changed = (
            abs(existing_asset.volatility - new_data['volatility']) > tolerance
        )

        if current_price_changed or old_price_changed or volatility_changed:
            return True
        return False
