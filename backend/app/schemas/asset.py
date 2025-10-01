from pydantic import BaseModel


class AssetBase(BaseModel):
    ticker: str
    name: str
    sector: str
    sector_type: str


class AssetCreate(AssetBase):
    pass


class AssetOut(AssetBase):
    id: int
    is_active: bool

    class Config:
        orm_mode = True
