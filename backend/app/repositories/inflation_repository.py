import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inflation import Inflation


class InflationRepository:
    def get_latest(self, session: Session):
        return session.execute(
            select(Inflation).order_by(Inflation.date.desc()).limit(1)
        ).scalar_one_or_none()

    def add(self, session: Session, date: datetime.date, value: float):
        existing = session.execute(
            select(Inflation).where(Inflation.date == date)
        ).scalar_one_or_none()

        if existing:
            return

        inflation = Inflation(date=date, value=value)
        session.add(inflation)
        session.commit()
        return inflation
