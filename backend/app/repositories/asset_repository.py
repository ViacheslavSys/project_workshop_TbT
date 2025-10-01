from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.schemas.asset import AssetCreate


def get_assets(db: Session):
    return db.query(Asset).all()


def create_asset(db: Session, asset_in: AssetCreate) -> Asset:
    asset = Asset(**asset_in.dict())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset
