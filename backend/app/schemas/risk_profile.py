from pydantic import BaseModel
from typing import List


class RiskQuestion(BaseModel):
    id: int
    text: str
    options: List[str]
    hidden: bool = False


class RiskAnswer(BaseModel):
    question_id: int
    answer: str


class RiskProfileResult(BaseModel):
    profile: str
    conservative_score: int
    moderate_score: int
    aggressive_score: int
