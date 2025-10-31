from sqlalchemy.orm import Session

from app.repositories import asset_repository
from app.schemas.asset import AssetCreate


def list_assets(db: Session):
    return asset_repository.get_assets(db)


def add_asset(db: Session, asset_in: AssetCreate):
    return asset_repository.create_asset(db, asset_in)
