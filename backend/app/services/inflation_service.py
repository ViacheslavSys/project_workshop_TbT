import datetime

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.repositories.inflation_repository import InflationRepository


def fetch_current_inflation() -> tuple[datetime.date, float]:
    """
    Парсер инфляции с сайта ЦБ РФ
    """
    url = "https://www.cbr.ru/key-indicators/"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    block = soup.find("div", class_="rate col-md-7 offset-md-1")
    if not block:
        raise ValueError("Не найден блок с инфляцией")

    value_text = block.find("div", class_="value").get_text(strip=True)
    value = float(value_text.replace("%", "").replace(",", ".").strip())

    date = datetime.date.today()
    return date, value


def update_inflation(session: Session):
    repo = InflationRepository()

    try:
        date, value = fetch_current_inflation()
        repo.add(session, date, value)
        print(f"Инфляция обновлена: {value}% ({date})")

    except Exception as e:
        print(f"Ошибка при парсинге инфляции: {e}")
        prev = repo.get_latest(session)
        if prev:
            repo.add(session, datetime.date.today(), prev.value)
            print(f"Использовано предыдущее значение: {prev.value}% ({prev.date})")
        else:
            print("Нет данных об инфляции — нечего подставлять.")
