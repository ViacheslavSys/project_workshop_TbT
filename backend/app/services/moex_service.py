import datetime
from typing import Dict, List

import numpy as np
import requests


def get_moex_price(ticker: str) -> float:
    url = (
        f"https://iss.moex.com/iss/engines/stock/markets/shares/"
        f"securities/{ticker}.json"
    )
    try:
        r = requests.get(url, timeout=10, proxies={"http": None, "https": None}).json()
        data = r.get("marketdata", {}).get("data", [])
        columns = r.get("marketdata", {}).get("columns", [])
        if not data or "LAST" not in columns:
            return 0.0
        idx = columns.index("LAST")
        # ищем первую строку с ненулевой ценой
        for row in data:
            price = row[idx]
            if price is not None and price > 0:
                return float(price)
    except Exception as e:
        print(f"[WARN] Ошибка get_moex_price({ticker}): {e}")
    return 0.0


def get_historical_price(ticker: str, years: int = 3) -> float:
    end_date = datetime.date.today()
    try:
        start_date = end_date.replace(year=end_date.year - years)
    except ValueError:
        start_date = end_date - datetime.timedelta(days=years * 365)

    url = (
        f"https://iss.moex.com/iss/history/engines/stock/markets/shares/securities/"
        f"{ticker}.json?from={start_date}&till={start_date}"
    )
    try:
        r = requests.get(url, timeout=10).json()
        data = r.get("history", {}).get("data", [])
        if data and len(data[0]) > 11:
            return float(data[0][11])
    except Exception:
        pass
    return get_moex_price(ticker) / 1.2


def get_historical_prices_series(ticker: str, days: int = 252) -> List[float]:
    url = (
        f"https://iss.moex.com/iss/history/engines/stock/markets/shares/"
        f"securities/{ticker}.json?limit={days}"
    )
    try:
        r = requests.get(url, timeout=10).json()
        data = r.get("history", {}).get("data", [])
        return [d[11] for d in data if isinstance(d[11], (int, float))]
    except Exception:
        return []


def calculate_volatility(prices: List[float]) -> float:
    if len(prices) < 2:
        return 0.0
    log_returns = np.diff(np.log(prices))
    return float(np.std(log_returns) * np.sqrt(252))


def fetch_asset_data(ticker: str, asset_type: str, period_years: int = 3) -> Dict:
    price_old = get_historical_price(ticker, years=period_years)
    price_now = get_moex_price(ticker)
    yield_value = (
        ((price_now / price_old) ** (1 / period_years) - 1) if price_old else 0.0
    )
    prices_series = get_historical_prices_series(ticker)
    volatility = calculate_volatility(prices_series)

    return {
        "name": ticker,
        "type": asset_type,
        "price_old": price_old,
        "price_now": price_now,
        "yield_value": yield_value,
        "volatility": volatility,
    }
