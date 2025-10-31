from app.core.database import SessionLocal
from app.schemas.portfolio import (
    PortfolioAnalysisRequest,
    PortfolioAnalysisResponse,
    PortfolioCalculationRequest,
    PortfolioCalculationResponse,
    PortfolioCreate,
)
from app.services.portfolio_analysis_service import PortfolioAnalysisService
from app.services.portfolio_service import PortfolioService
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
    Расчет целевой стоимости с учетом инфляции и формирование портфеля
    """
    try:
        portfolio_service = PortfolioService(db)
        result = portfolio_service.calculate_portfolio(request.user_id)
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при расчете: {str(e)}")


@router.post("/create")
async def create_portfolio(
    portfolio_in: PortfolioCreate, db: Session = Depends(get_db)
):
    """
    Сохранение портфеля в базе данных
    """
    try:
        portfolio_service = PortfolioService(db)

        # Получаем расчет портфеля
        calculation = portfolio_service.calculate_portfolio(portfolio_in.user_id)

        # Здесь можно добавить логику сохранения в БД
        # using your existing repository functions

        return {
            "message": "Портфель успешно создан",
            "portfolio_id": "generated_id",  # Замените на реальный ID
            "calculation": calculation,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка при создании портфеля: {str(e)}"
        )


@router.post("/analyze", response_model=PortfolioAnalysisResponse)
async def analyze_user_portfolio(request: PortfolioAnalysisRequest):
    """Анализирует портфель пользователя через LLM"""
    service = PortfolioAnalysisService()

    analysis_result = service.analyze_portfolio(request.user_id)
    return PortfolioAnalysisResponse(analysis=analysis_result)
