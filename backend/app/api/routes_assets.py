from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.asset import AssetCreate, AssetOut
from app.services import asset_service

router = APIRouter(prefix="/assets", tags=["assets"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[AssetOut])
def list_assets(db: Session = Depends(get_db)):
    return asset_service.list_assets(db)


@router.post("/", response_model=AssetOut)
def create_asset(asset_in: AssetCreate, db: Session = Depends(get_db)):
    return asset_service.add_asset(db, asset_in)
