from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.portfolio import PortfolioCreate, PortfolioOut
from app.services import portfolio_service

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[PortfolioOut])
def list_portfolios(user_id: int, db: Session = Depends(get_db)):
    return portfolio_service.list_portfolios(db, user_id)


@router.post("/", response_model=PortfolioOut)
def create_portfolio(
    user_id: int, portfolio_in: PortfolioCreate, db: Session = Depends(get_db)
):
    return portfolio_service.add_portfolio(db, user_id, portfolio_in)


@router.delete("/{portfolio_id}")
def delete_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    success = portfolio_service.remove_portfolio(db, portfolio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"message": "Portfolio deleted successfully"}
