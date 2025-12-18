from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.asset_repository import AssetRepository
from app.schemas.asset import AssetOut

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/", response_model=List[AssetOut])
async def get_assets(db: AsyncSession = Depends(get_db)):
    """Получить все активы асинхронно"""
    repo = AssetRepository()
    assets = await repo.get_all_assets(db)
    return assets
