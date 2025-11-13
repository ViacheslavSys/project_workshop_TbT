from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.portfolio import (
    PortfolioAnalysisRequest,
    PortfolioAnalysisResponse,
    PortfolioCalculationRequest,
    PortfolioCalculationResponse,
    PortfolioCreate,
    PortfolioListResponse,
    PortfolioSaveResponse,
    PortfolioSummary,
)
from app.services.portfolio_analysis_service import PortfolioAnalysisService
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


# @router.post("/create")
# async def create_portfolio(
#     portfolio_in: PortfolioCreate, db: Session = Depends(get_db)
# ):
#     """
#     Сохранение портфеля в базе данных
#     """
#     try:
#         portfolio_service = PortfolioService(db)

#         # Получаем расчет портфеля
#         calculation = portfolio_service.calculate_portfolio(portfolio_in.user_id)

#         # Здесь можно добавить логику сохранения в БД
#         # using your existing repository functions

#         return {
#             "message": "Портфель успешно создан",
#             "portfolio_id": "generated_id",  # Замените на реальный ID
#             "calculation": calculation,
#         }

#     except ValueError as e:
#         raise HTTPException(status_code=400, detail=str(e))
#     except Exception as e:
#         raise HTTPException(
#             status_code=500, detail=f"Ошибка при создании портфеля: {str(e)}"
#         )


@router.post("/analyze", response_model=PortfolioAnalysisResponse)
async def analyze_user_portfolio(request: PortfolioAnalysisRequest):
    """Анализирует портфель пользователя через LLM"""
    service = PortfolioAnalysisService()

    analysis_result = service.analyze_portfolio(request.user_id)
    return PortfolioAnalysisResponse(analysis=analysis_result)


@router.post("/save-to-db", response_model=PortfolioSaveResponse)
async def save_portfolio_to_db(
    portfolio_in: PortfolioCreate, db: Session = Depends(get_db)
):
    """
    Сохранение рассчитанного портфеля из Redis в базу данных
    """
    try:
        portfolio_service = PortfolioService(db)

        user_id_int = int(portfolio_in.user_id)

        result = portfolio_service.save_portfolio_to_db(
            user_id=user_id_int, portfolio_name=portfolio_in.portfolio_name
        )

        return PortfolioSaveResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка при сохранении портфеля: {str(e)}"
        )


@router.get("/user/{user_id}", response_model=PortfolioListResponse)
async def get_user_portfolios(user_id: int, db: Session = Depends(get_db)):
    """
    Получение списка всех портфелей пользователя (только основные данные)
    """
    try:
        portfolio_service = PortfolioService(db)
        portfolios = portfolio_service.get_user_portfolios_from_db(user_id)

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
    user_id: int = Query(
        ..., description="ID пользователя"
    ),  # передаем как query parameter
    db: Session = Depends(get_db),
):
    """
    Получение детальной информации о конкретном портфеле
    """
    try:
        portfolio_service = PortfolioService(db)

        portfolio = portfolio_service.portfolio_repo.get_portfolio_by_id(
            portfolio_id, user_id
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
