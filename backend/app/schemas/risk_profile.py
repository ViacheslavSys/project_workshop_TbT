from typing import List, Optional

from pydantic import BaseModel


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
    investment_horizon: Optional[str] = None


class ClarificationAnswer(BaseModel):
    code: str
    answer: str


class ClarificationQuestion(BaseModel):
    code: str
    question: str
    options: List[str]
