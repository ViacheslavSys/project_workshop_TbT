from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# Асинхронный движок для FastAPI
async_engine = create_async_engine(
    settings.DATABASE_URL, echo=True, future=True, pool_size=20, max_overflow=0
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Синхронный движок для Celery
# Конвертируем асинхронный URL в синхронный
sync_database_url = settings.DATABASE_URL.replace(
    'postgresql+asyncpg://', 'postgresql://'
).replace('postgresql+asyncpg:', 'postgresql:')

sync_engine = create_engine(sync_database_url, echo=False, pool_size=10, max_overflow=0)

# Синхронная сессия для Celery задач
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)

Base = declarative_base()


async def get_db() -> AsyncSession:
    """Dependency для получения асинхронной сессии (для FastAPI)"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def get_sync_db():
    """Получение синхронной сессии (для Celery задач)"""
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()
