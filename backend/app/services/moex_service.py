# services/moex_service.py
import datetime
from typing import Dict, List, Tuple

import numpy as np
import requests


def safe_float_convert(value) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


def find_nearest_trading_date(
    ticker: str,
    engine: str,
    market: str,
    target_date: datetime.date,
    days_range: int = 30,
) -> Tuple[float, datetime.date]:
    """Найти ближайшую дату с торгами"""
    for days_offset in range(0, days_range + 1):
        # Пробуем даты в обе стороны от целевой
        for direction in [0, 1, -1]:
            if days_offset == 0 and direction != 0:
                continue

            current_date = target_date + datetime.timedelta(
                days=direction * days_offset
            )

            # Пропускаем выходные для эффективности
            if current_date.weekday() >= 5:
                continue

            url = (
                f"https://iss.moex.com/iss/history/engines/{engine}/markets/"
                f"{market}/securities/{ticker}.json"
            )
            params = {
                'from': current_date.strftime('%Y-%m-%d'),
                'till': current_date.strftime('%Y-%m-%d'),
                'history.columns': 'OPEN',
                'iss.meta': 'off',
            }

            try:
                response = requests.get(url, params=params, timeout=10)
                data = response.json()
                history_data = data.get("history", {}).get("data", [])

                if history_data:
                    open_price = safe_float_convert(history_data[0][0])
                    if open_price > 0:
                        days_diff = (current_date - target_date).days
                        if days_diff == 0:
                            print(
                                f"[SUCCESS] {ticker}: точная цена на {current_date}: "
                                f"{open_price}"
                            )
                        else:
                            print(
                                f"[SUCCESS] {ticker}: цена на {current_date} "
                                f"(смещение {days_diff} дней): {open_price}"
                            )
                        return open_price, current_date

            except Exception:
                continue

    print(
        f"[WARN] {ticker}: не найдено торгов в диапазоне ±{days_range} дней от "
        f"{target_date}"
    )
    return 0.0, target_date


def fetch_all_prices_data(tickers: List[Tuple[str, str, str]]) -> Dict[str, Dict]:
    """Получить ВСЕ данные с MOEX за один раз для всех активов"""

    price_data = {}

    for ticker, asset_type, asset_name in tickers:
        print(f"[INFO] Получение данных для {asset_name} ({ticker}, {asset_type})")

        # Определяем рынок
        if (
            asset_type == "акция"
            or asset_type == "золото"
            or asset_type == "недвижимость"
        ):
            engine = "stock"
            market = "shares"
        elif "облигация" in asset_type:
            engine = "stock"
            market = "bonds"
        else:
            engine = "stock"
            market = "shares"

        # 1. Текущая цена OPEN
        current_price = 0.0
        url_current = (
            f"https://iss.moex.com/iss/engines/{engine}/markets/"
            f"{market}/securities/{ticker}.json"
        )
        try:
            response = requests.get(url_current, timeout=10)
            data = response.json()
            marketdata = data.get("marketdata", {})
            data_rows = marketdata.get("data", [])
            columns = marketdata.get("columns", [])

            if data_rows and "OPEN" in columns:
                open_idx = columns.index("OPEN")
                for row in data_rows:
                    price = row[open_idx]
                    price_float = safe_float_convert(price)
                    if price_float > 0:
                        current_price = price_float
                        break
        except Exception as e:
            print(f"[WARN] Ошибка получения текущей цены OPEN для {ticker}: {e}")

        # 2. Историческая цена OPEN (3 года назад) - ИЩЕМ БЛИЖАЙШУЮ ДАТУ
        historical_price = 0.0
        historical_date = None

        end_date = datetime.date.today()
        target_date = end_date - datetime.timedelta(days=3 * 365)

        historical_price, historical_date = find_nearest_trading_date(
            ticker, engine, market, target_date, days_range=60
        )

        # 3. Исторические цены OPEN для волатильности
        historical_prices = []
        url_volatility = (
            f"https://iss.moex.com/iss/history/engines/{engine}"
            f"/markets/{market}/securities/{ticker}.json"
        )
        params_volatility = {'limit': 252, 'history.columns': 'OPEN', 'iss.meta': 'off'}

        try:
            response = requests.get(
                url_volatility, params=params_volatility, timeout=10
            )
            data = response.json()
            history_data = data.get("history", {}).get("data", [])

            for row in history_data:
                if len(row) > 0:
                    price = safe_float_convert(row[0])
                    if price > 0:
                        historical_prices.append(price)

            print(
                f"[DEBUG] {ticker}: получено {len(historical_prices)} исторических цен"
            )

        except Exception as e:
            print(
                f"[WARN] Ошибка получения исторических цен для волатильности {ticker}: "
                f"{e}"
            )

        price_data[ticker] = {
            'name': asset_name,  # Человеко-читаемое название
            'ticker': ticker,  # Тикер
            'asset_type': asset_type,
            'current_price': current_price,
            'historical_price': historical_price,
            'historical_date': historical_date,
            'historical_prices_series': historical_prices,
        }

        print(
            f"[SUMMARY] {asset_name} ({ticker}): current={current_price}, "
            f"historical={historical_price}, prices_series={len(historical_prices)}"
        )

    return price_data


def calculate_yield_and_volatility(price_data: Dict[str, Dict]) -> Dict[str, Dict]:
    """Рассчитать доходность и волатильность для всех активов"""

    results = {}

    for ticker, data in price_data.items():
        asset_name = data['name']
        asset_type = data['asset_type']
        current_price = data['current_price']
        historical_price = data['historical_price']
        historical_date = data['historical_date']
        prices_series = data['historical_prices_series']

        # Расчет доходности
        yield_value = 0.0
        if historical_price > 0 and current_price > 0:
            # Точный расчет с учетом реального количества лет
            end_date = datetime.date.today()
            days_diff = (end_date - historical_date).days
            years_diff = max(days_diff / 365.25, 0.1)  # Минимум 0.1 года

            yield_value = (current_price / historical_price) ** (1 / years_diff) - 1
            print(
                f"[CALC] {asset_name}: доходность = {yield_value:.4f} "
                f"за {years_diff:.2f} лет"
            )
        else:
            # Fallback по типу актива
            if "облигация" in asset_type:
                if "краткосроч" in asset_type:
                    yield_value = 0.08
                elif "среднесроч" in asset_type:
                    yield_value = 0.09
                elif "долгосроч" in asset_type:
                    yield_value = 0.10
                else:
                    yield_value = 0.085
            elif asset_type == "акция":
                yield_value = 0.12
            elif asset_type == "золото":
                yield_value = 0.06
            elif asset_type == "недвижимость":
                yield_value = 0.07
            else:
                yield_value = 0.08
            print(
                f"[FALLBACK] {asset_name}: доходность по умолчанию = {yield_value:.4f}"
            )

        # Расчет волатильности
        volatility = 0.0
        if len(prices_series) >= 2:
            try:
                returns = []
                for i in range(1, len(prices_series)):
                    if prices_series[i - 1] > 0 and prices_series[i] > 0:
                        log_return = np.log(prices_series[i] / prices_series[i - 1])
                        returns.append(log_return)

                if len(returns) >= 2:
                    daily_volatility = np.std(returns)
                    volatility = float(daily_volatility * np.sqrt(252))
                    print(
                        f"[CALC] {asset_name}: волатильность = {volatility:.4f} "
                        f"(на основе {len(returns)} доходностей)"
                    )
                else:
                    volatility = get_fallback_volatility(asset_type)
                    print(
                        f"[FALLBACK] {asset_name}: волатильность по умолчанию = "
                        f"{volatility:.4f}"
                    )
            except Exception as e:
                print(f"[ERROR] {asset_name}: ошибка расчета волатильности: {e}")
                volatility = get_fallback_volatility(asset_type)
        else:
            volatility = get_fallback_volatility(asset_type)
            print(
                f"[FALLBACK] {asset_name}: недостаточно данных для волатильности, "
                f"используется значение по умолчанию: {volatility:.4f}"
            )

        results[ticker] = {
            'name': asset_name,  # Человеко-читаемое название
            'ticker': ticker,  # Тикер
            'type': asset_type,
            'price_old': float(historical_price),
            'price_now': float(current_price),
            'yield_value': float(yield_value),
            'volatility': float(volatility),
        }

    return results


def get_fallback_volatility(asset_type: str) -> float:
    """Получить fallback значение волатильности по типу актива"""
    if "облигация" in asset_type:
        return 0.05
    elif asset_type == "акция":
        return 0.20
    elif asset_type == "золото":
        return 0.15
    elif asset_type == "недвижимость":
        return 0.15
    else:
        return 0.15


def fetch_asset_data_batch(tickers: List[Tuple[str, str, str]]) -> List[Dict]:
    """Основная функция: получить все данные и рассчитать показатели"""

    print(f"[BATCH] Начало получения данных для {len(tickers)} активов")

    # 1. Получить все данные с MOEX
    price_data = fetch_all_prices_data(tickers)

    # 2. Рассчитать все показатели
    results = calculate_yield_and_volatility(price_data)

    # 3. Вернуть в формате для репозитория
    return list(results.values())
