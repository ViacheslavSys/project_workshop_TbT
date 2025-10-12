from typing import List, Optional
from app.schemas.risk_profile import RiskAnswer, RiskProfileResult


QUESTIONS = [
    {"id": 1, "text": "На какой срок вы планируете инвестировать?",
     "options": ["A) до 3 лет", "B) 3–7 лет", "C) более 7 лет"]},
    {"id": 2, "text": "Какая ваша главная инвестиционная цель?  ",
     "options": [
         "A) сохранить капитал, защитить от инфляции ",
         "B) постепенно накопить на конкретную цель",
         "C) максимально увеличить капитал в долгосрочной перспективе"
        ]
    },
    {"id": 3, "text": "Какую часть вашего капитала вы планируете инвестировать?",
     "options": ["A) менее 25%", "B) от 25% до 50%", "C) более 50%"]},
    {"id": 4, "text": " Если ваш портфель упадет на 20% за 6 месяцев, что вы сделаете?",
     "options": ["A) продам все, чтобы избежать дальнейших потерь ",
                 "B) оставлю как есть, подожду восстановления",
                 "C) докуплю больше активов по низким ценам "]},
    {"id": 5, "text": " Какую максимальную просадку вы готовы пережить?",
     "options": ["A) до 10% ", "B) от 10% до 25%", "C) более 25%"]},
    {"id": 6, "text": "Какую доходность вы считаете приемлемой?",
     "options": ["A) 5-8% годовых", "B) 8-12% годовых", "C) 15%+ годовых "]},
    {"id": 7, "text": " Какой у вас опыт инвестирования?",
     "options": ["A) нет опыта или меньше 1 года",
                 "B) от 1 до 3 лет(есть базовый опыт)",
                 "C) более 3 лет (регулярно инвестирую)"]},
    {"id": 8, "text": "Насколько хорошо вы разбираетесь в инвестиционных инструментах?",
     "options": ["A) знаю только базовые инструменты (вклады, облигации)",
                 "B) разбираюсь в акциях, ETF, фондах",
                 "C) понимаю сложные инструменты (деривативы, венчурные инвестиции)"]},
]


def determine_profile_v2(conservative, moderate, aggressive, answers_map) -> str:
    conservative, moderate, aggressive = apply_restrictions(
        conservative, moderate, aggressive, answers_map
    )

    if (aggressive >= 15 and aggressive > moderate + 5 and answers_map.get(7) != "A"
        and answers_map.get(1) != "A"):
        return "Агрессивный"

    if (conservative >= 5 and conservative > moderate):
        return "Консервативный"

    if (moderate >= 8 or answers_map.get(7) == "A" or answers_map.get(1) == "A"):
        return "Умеренный"

    return "Умеренный"


def apply_restrictions(conservative, moderate, aggressive, answers_map):
    if answers_map.get(7) == "A":
        aggressive = moderate

    if answers_map.get(1) == "A":
        aggressive = moderate

    return conservative, moderate, aggressive


def calculate_profile_v2(
    answers: List[RiskAnswer],
) -> RiskProfileResult:
    answers_map = {a.question_id: a.answer.strip()[0].upper() for a in answers}
    
    conservative = moderate = aggressive = 0
    scoring = {
        1: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        2: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        3: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        4: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        5: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        6: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        7: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        8: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
    }

    for qid, ans in answers_map.items():
        if qid in scoring and ans in scoring[qid]:
            prof, val = scoring[qid][ans]
            if prof == "cons":
                conservative += val
            elif prof == "mod":
                moderate += val
            else:
                aggressive += val

    conservative, moderate, aggressive = apply_restrictions(
        conservative, moderate, aggressive, answers_map
    )

    profile = determine_profile_v2(conservative, moderate, aggressive, answers_map)

    return RiskProfileResult(
        profile=profile,
        conservative_score=conservative,
        moderate_score=moderate,
        aggressive_score=aggressive,
    )
 