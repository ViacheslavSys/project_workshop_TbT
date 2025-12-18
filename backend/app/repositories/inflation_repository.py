import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inflation import Inflation


class InflationRepository:
    async def get_latest(self, session: AsyncSession):
        """Получить последнюю инфляцию асинхронно"""
        stmt = select(Inflation).order_by(Inflation.date.desc()).limit(1)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, session: AsyncSession, date: datetime.date, value: float):
        """Добавить данные по инфляции асинхронно"""
        stmt = select(Inflation).where(Inflation.date == date)
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            return

        inflation = Inflation(date=date, value=value)
        session.add(inflation)
        await session.commit()
        return inflation
