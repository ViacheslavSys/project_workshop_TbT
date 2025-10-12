from fastapi import APIRouter, HTTPException
from app.schemas.risk_profile import RiskQuestion, RiskAnswer, RiskProfileResult
from app.services.risk_profile_service import (
    QUESTIONS,
    calculate_profile_v2,
)
from app.core.redis_cache import RedisCache

router = APIRouter(prefix="/risk-profile", tags=["risk-profile"])
cache = RedisCache()


@router.get("/questions", response_model=list[RiskQuestion])
def get_questions():
    """Возвращает список видимых вопросов"""
    visible = [RiskQuestion(**q) for q in QUESTIONS if not q.get("hidden", False)]
    return visible


@router.post("/answers")
def submit_answers(user_id: str, answers: list[RiskAnswer]):
    """
    Принимает базовые ответы, проверяет противоречия.
    """

    result = calculate_profile_v2(answers)
    cache.set_json(f"user:{user_id}:risk_result", result.dict())

    return result


@router.get("/result", response_model=RiskProfileResult)
def get_result(user_id: str):
    """Возвращает сохранённый результат"""
    data = cache.get_json(f"user:{user_id}:risk_result")
    if not data:
        raise HTTPException(status_code=404, detail="Нет сохранённого результата")
    return RiskProfileResult(**data)
