from typing import Dict, List

from app.schemas.risk_profile import RiskAnswer, RiskProfileResult

QUESTIONS = [
    {
        "id": 1,
        "text": "На какой срок вы планируете инвестировать?",
        "options": ["A) До 3 лет", "B) 3–7 лет", "C) Более 7 лет"],
    },
    {
        "id": 2,
        "text": "Есть ли у вас опыт инвестирования?",
        "options": ["A) Нет опыта", "B) 1-3 года", "C) Более 3 лет"],
    },
    {
        "id": 3,
        "text": "Как вы предпочитаете управлять инвестициями?",
        "options": [
            "A) Автоматически / доверительное управление",
            "B) Через фонды и ETF",
            "C) Самостоятельно, анализируя рынок",
        ],
    },
    {
        "id": 4,
        "text": "Как часто вы планируете пополнять портфель?",
        "options": [
            "A) Иногда / нерегулярно",
            "B) Раз в квартал",
            "C) Регулярно (раз в месяц или чаще)",
        ],
    },
    {
        "id": 5,
        "text": "Текущий инвестиционный капитал",
        "options": ["A) Менее 1 млн ₽", "B) 1-5 млн ₽", "C) Более 5 млн ₽"],
    },
    {
        "id": 6,
        "text": "Дополнительные вложения в год",
        "options": ["A) Менее 300 тыс ₽", "B) 300 тыс - 1 млн ₽", "C) Более 1 млн ₽"],
    },
    {
        "id": 7,
        "text": "Доля инвестиций от дохода",
        "options": ["A) Менее 20%", "B) 20-40%", "C) Более 40%"],
    },
    {
        "id": 8,
        "text": "Просадка, с которой вы готовы мириться",
        "options": ["A) До -10%", "B) -10% до -25%", "C) Более -25%"],
    },
    {
        "id": 9,
        "text": "Как вы поступите при падении рынка на 20%?",
        "options": [
            "A) Продам часть активов",
            "B) Ничего не буду делать",
            "C) Докуплю",
        ],
    },
    {
        "id": 10,
        "text": "Какая доходность приемлема?",
        "options": ["A) 6-10% годовых", "B) 10-18% годовых", "C) 18%+ годовых"],
    },
    {
        "id": 11,
        "text": "Резкое падение рынка вызывает у вас...",
        "options": [
            "A) Стресс и тревогу",
            "B) Умеренное беспокойство",
            "C) Спокойствие / интерес",
        ],
    },
    {
        "id": 12,
        "text": "Как вы реагируете на новости о кризисах?",
        "options": [
            "A) Сразу проверяю счета",
            "B) Наблюдаю, не предпринимаю действий",
            "C) Рассматриваю как возможность",
        ],
    },
    {
        "id": 13,
        "text": "Как вы оцениваете свою психологическую устойчивость к потерям?",
        "options": ["A) Слабая", "B) Средняя", "C) Высокая"],
    },
]


def check_all_contradictions(answers: dict) -> List[Dict]:
    """Проверка противоречий по новым правилам"""
    contradictions = []

    # Поведенческие противоречия
    if answers.get(8) == "A" and answers.get(9) == "C":
        contradictions.append(
            {
                "code": "low_risk_buy_dip",
                "question": "Вы указали низкую терпимость к просадкам, "
                + "но готовы докупать при падении. Что для вас приоритетнее?",
                "options": [
                    "A) Сохранение капитала важнее",
                    "B) Готов к умеренному риску для роста",
                ],
            }
        )

    if answers.get(2) == "A" and answers.get(3) == "C":
        contradictions.append(
            {
                "code": "no_experience_self_management",
                "question": "Без опыта вы выбираете самостоятельное управление. "
                + "Рекомендуем начать с ETF. Согласны?",
                "options": [
                    "A) Да, начну с ETF",
                    "B) Нет, хочу самостоятельное управление",
                ],
            }
        )

    if answers.get(5) == "C" and (answers.get(11) == "A" or answers.get(9) == "A"):
        contradictions.append(
            {
                "code": "large_capital_fear",
                "question": "При крупном капитале вы отмечаете осторожность. "
                + "Хотите консервативную стратегию с защитой?",
                "options": [
                    "A) Да, сохранение важнее роста",
                    "B) Нет, готов к умеренному риску",
                ],
            }
        )

    if answers.get(5) == "A" and answers.get(10) == "C":
        contradictions.append(
            {
                "code": "small_capital_high_return",
                "question": "При небольшом капитале вы ожидаете высокую доходность."
                + " Рекомендуем начать с умеренных стратегий. Согласны?",
                "options": [
                    "A) Да, начну с умеренного риска",
                    "B) Нет, готов к высокому риску",
                ],
            }
        )

    if answers.get(7) == "C" and answers.get(5) == "A":
        contradictions.append(
            {
                "code": "high_investment_low_capital",
                "question": "Вы инвестируете значительную долю дохода при небольшом "
                + "капитале. Уверены, что это не повлияет на финансовую стабильность?",
                "options": [
                    "A) Пересмотрю долю инвестиций",
                    "B) Это комфортный для меня уровень",
                ],
            }
        )

    return contradictions


def apply_restrictions(
    conservative: int, moderate: int, aggressive: int, answers_map: dict
):
    """Применение ограничивающих условий"""

    if answers_map.get(2) == "A":
        aggressive = min(aggressive, moderate)

    if answers_map.get(8) == "A":
        aggressive = 0
        moderate = 0
        conservative = max(conservative, 8)

    if answers_map.get(11) == "A" or answers_map.get(9) == "A":
        aggressive = 0
        moderate = 0
        conservative = max(conservative, 8)

    if answers_map.get(2) == "A" and answers_map.get(5) == "C":
        aggressive = min(aggressive, moderate)

    return conservative, moderate, aggressive


def determine_profile_v2(
    conservative: int, moderate: int, aggressive: int, answers_map: dict
) -> str:
    """Определение профиля по новым правилам"""

    conservative, moderate, aggressive = apply_restrictions(
        conservative, moderate, aggressive, answers_map
    )

    if aggressive >= 15:
        return "Агрессивный"
    elif conservative <= 7:
        return "Консервативный"
    else:
        return "Умеренный"


def calculate_profile_v2(answers: List[RiskAnswer]) -> RiskProfileResult:
    """Основной расчет профиля"""
    answers_map = {a.question_id: a.answer.strip()[0].upper() for a in answers}

    conservative = moderate = aggressive = 0

    scoring = {
        1: {"A": ("", 0), "B": ("", 0), "C": ("", 0)},
        2: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        3: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        4: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        5: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        6: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        7: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        8: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        9: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        10: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        11: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        12: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        13: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
    }

    for qid, ans in answers_map.items():
        if qid in scoring and ans in scoring[qid]:
            prof, val = scoring[qid][ans]
            if prof == "cons":
                conservative += val
            elif prof == "mod":
                moderate += val
            elif prof == "agr":
                aggressive += val

    profile = determine_profile_v2(conservative, moderate, aggressive, answers_map)

    horizon_mapping = {"A": "До 3 лет", "B": "3–7 лет", "C": "Более 7 лет"}
    investment_horizon = horizon_mapping.get(answers_map.get(1))

    return RiskProfileResult(
        profile=profile,
        conservative_score=conservative,
        moderate_score=moderate,
        aggressive_score=aggressive,
        investment_horizon=investment_horizon,
    )


def calculate_profile_v2_with_clarifications(
    answers: List[RiskAnswer], clarification_answers: List[Dict[str, str]]
) -> RiskProfileResult:
    """Расчет профиля с учетом уточняющих ответов"""
    answers_map = {a.question_id: a.answer.strip()[0].upper() for a in answers}

    for clarification in clarification_answers:
        code = clarification["code"]
        answer = clarification["answer"].strip()[0].upper()

        if code == "low_risk_buy_dip":
            if answer == "A":
                answers_map[9] = "A"
            elif answer == "B":
                answers_map[8] = "B"
        elif code == "no_experience_self_management":
            if answer == "A":
                answers_map[3] = "B"

        elif code == "large_capital_fear":
            if answer == "A":
                answers_map[9] = "A"
                answers_map[10] = "A"
            elif answer == "B":
                answers_map[11] = "B"
        elif code == "small_capital_high_return":
            if answer == "A":
                answers_map[10] = "B"
            elif answer == "B":
                pass

        elif code == "high_investment_low_capital":
            if answer == "A":
                answers_map[7] = "B"

    # Пересчитываем с обновленными ответами
    return calculate_profile_v2(
        [RiskAnswer(question_id=k, answer=v) for k, v in answers_map.items()]
    )
