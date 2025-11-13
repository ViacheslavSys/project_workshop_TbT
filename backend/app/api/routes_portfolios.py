from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.portfolio import (
    PortfolioAnalysisRequest,
    PortfolioAnalysisResponse,
    PortfolioCalculationRequest,
    PortfolioCalculationResponse,
    PortfolioListResponse,
    PortfolioSaveRequest,
    PortfolioSaveResponse,
    PortfolioSummary,
)
from app.services.portfolio_analysis_service import PortfolioAnalysisService
from app.services.portfolio_service import PortfolioService

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


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


@router.post("/analyze", response_model=PortfolioAnalysisResponse)
async def analyze_user_portfolio(
    request: PortfolioAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Анализирует портфель пользователя через LLM"""
    try:
        service = PortfolioAnalysisService()

        analysis_result = service.analyze_portfolio(
            user_id=current_user.id, portfolio_id=request.portfolio_id, db_session=db
        )

        return PortfolioAnalysisResponse(analysis=analysis_result)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка при анализе портфеля: {str(e)}"
        )


@router.post("/save-to-db", response_model=PortfolioSaveResponse)
async def save_portfolio_to_db(
    request: PortfolioSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Сохранение рассчитанного портфеля из Redis в базу данных
    """
    try:
        portfolio_service = PortfolioService(db)

        user_id_int = int(request.user_id)

        result = portfolio_service.save_portfolio_to_db(
            session_token=user_id_int,  # session_token из Redis
            user_id=current_user.id,  # authenticated user_id из JWT
            portfolio_name=request.portfolio_name,
        )

        return PortfolioSaveResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка при сохранении портфеля: {str(e)}"
        )


@router.get("/user", response_model=PortfolioListResponse)
async def get_user_portfolios(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Получение списка всех портфелей пользователя (только основные данные)
    """
    try:
        portfolio_service = PortfolioService(db)
        portfolios = portfolio_service.get_user_portfolios_from_db(current_user.id)

        # Преобразуем в список PortfolioSummary
        portfolio_summaries = []
        for portfolio in portfolios:
            portfolio_summaries.append(
                PortfolioSummary(
                    id=portfolio.id,
                    portfolio_name=portfolio.portfolio_name,
                    target_amount=portfolio.target_amount,
                    initial_capital=portfolio.initial_capital,
                    risk_profile=portfolio.risk_profile,
                    created_at=portfolio.created_at,
                )
            )

        return PortfolioListResponse(portfolios=portfolio_summaries)

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка при получении портфелей: {str(e)}"
        )


@router.get("/{portfolio_id}", response_model=PortfolioCalculationResponse)
async def get_portfolio_detail(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получение детальной информации о конкретном портфеле
    """
    try:
        portfolio_service = PortfolioService(db)

        portfolio = portfolio_service.portfolio_repo.get_portfolio_by_id(
            portfolio_id, current_user.id
        )

        if not portfolio:
            raise HTTPException(status_code=404, detail="Портфель не найден")

        portfolio_response = portfolio_service.convert_db_to_response(portfolio)

        return portfolio_response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка при получении портфеля: {str(e)}"
        )
