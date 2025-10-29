from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.portfolio import (
    PortfolioCalculationRequest,
    PortfolioCalculationResponse,
)
from app.services.portfolio_service import PortfolioService

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/calculate", response_model=PortfolioCalculationResponse)
async def calculate_portfolio(
    request: PortfolioCalculationRequest, db: Session = Depends(get_db)
):
    """
    Расчет целевой стоимости с учетом инфляции
    """
    try:
        portfolio_service = PortfolioService(db)
        result = portfolio_service.calculate_portfolio(request.user_id)
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при расчете: {str(e)}")
