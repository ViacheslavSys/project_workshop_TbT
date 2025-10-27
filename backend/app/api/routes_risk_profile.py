from fastapi import APIRouter, HTTPException
from typing import List, Dict
from app.schemas.risk_profile import RiskQuestion, RiskAnswer, RiskProfileResult
from app.services.risk_profile_service import (
    QUESTIONS,
    calculate_profile_v2,
    check_all_contradictions,
    calculate_profile_v2_with_clarifications
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
    Первый шаг: принимает базовые ответы, проверяет противоречия.
    Если нужно — возвращает уточняющий вопрос, БЕЗ расчёта профиля.
    """
    answers_map = {a.question_id: a.answer.strip()[0].upper() for a in answers}

    all_contradictions = check_all_contradictions(answers_map)
    if all_contradictions:
        cache.set_json(f"user:{user_id}:pending_answers", [a.dict() for a in answers])

        clarifying_questions = []

        for contradiction in all_contradictions:
            clarifying_questions.append({
                "code": contradiction["code"],
                "question": contradiction["question"],
                "options": contradiction["options"]
            })

        return {
            "stage": "clarification_needed",
            "clarifying_questions": clarifying_questions,
            "total_questions": len(clarifying_questions)
        }

    result = calculate_profile_v2(answers)
    cache.set_json(f"user:{user_id}:risk_result", result.dict())
    return {
        "stage": "final",
        "result": result
    }


@router.post("/clarify")
def clarify_profile(
    user_id: str,
    clarification_answers: List[Dict[str, str]]
):
    """
    Принимает ВСЕ ответы на уточняющие вопросы и выдает финальный результат
    """
    saved_answers = cache.get_json(f"user:{user_id}:pending_answers")
    if not saved_answers:
        raise HTTPException(status_code=400, detail="Нет сохранённых ответов")

    result = calculate_profile_v2_with_clarifications(
        [RiskAnswer(**a) for a in saved_answers],
        clarification_answers
    )

    cache.set_json(f"user:{user_id}:risk_result", result.dict())
    cache.set_json(f"user:{user_id}:pending_answers", None)

    return {"stage": "final", "result": result}


@router.get("/result", response_model=RiskProfileResult)
def get_result(user_id: str):
    """Возвращает сохранённый результат"""
    data = cache.get_json(f"user:{user_id}:risk_result")
    if not data:
        raise HTTPException(status_code=404, detail="Нет сохранённого результата")
    return RiskProfileResult(**data)
