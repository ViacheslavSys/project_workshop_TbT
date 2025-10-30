from typing import Dict, List

from app.schemas.risk_profile import RiskAnswer, RiskProfileResult

QUESTIONS = [
    # Блок 1 – Опыт и вовлечённость
    {
        "id": 1,
        "text": "Есть ли у вас опыт инвестирования?",
        "options": ["A) Нет опыта", "B) 1-3 года", "C) Более 3 лет"],
    },
    {
        "id": 2,
        "text": "Как вы предпочитаете управлять инвестициями?",
        "options": [
            "A) Автоматически / доверительное управление",
            "B) Через фонды и ETF",
            "C) Самостоятельно, анализируя рынок",
        ],
    },
    {
        "id": 3,
        "text": "Как часто вы планируете пополнять портфель?",
        "options": [
            "A) Иногда / нерегулярно",
            "B) Раз в квартал",
            "C) Регулярно (раз в месяц или чаще)",
        ],
    },
    # Блок 2 – Финансовое положение
    {
        "id": 4,
        "text": "Дополнительные вложения в год",
        "options": ["A) Менее 300 тыс ₽", "B) 300 тыс - 1 млн ₽", "C) Более 1 млн ₽"],
    },
    {
        "id": 5,
        "text": "Доля инвестиций от дохода",
        "options": ["A) Менее 20%", "B) 20-40%", "C) Более 40%"],
    },
    # Блок 3 – Отношение к риску
    {
        "id": 6,
        "text": "Просадка, с которой вы готовы мириться",
        "options": ["A) До -10%", "B) -10% до -25%", "C) Более -25%"],
    },
    {
        "id": 7,
        "text": "Как вы поступите при падении рынка на 20%?",
        "options": [
            "A) Продам часть активов",
            "B) Ничего не буду делать",
            "C) Докуплю",
        ],
    },
    {
        "id": 8,
        "text": "Какая доходность приемлема?",
        "options": ["A) 6-10% годовых", "B) 10-18% годовых", "C) 18%+ годовых"],
    },
    # Блок 4 – Эмоциональная устойчивость
    {
        "id": 9,
        "text": "Резкое падение рынка вызывает у вас...",
        "options": [
            "A) Стресс и тревогу",
            "B) Умеренное беспокойство",
            "C) Спокойствие / интерес",
        ],
    },
    {
        "id": 10,
        "text": "Как вы реагируете на новости о кризисах?",
        "options": [
            "A) Сразу проверяю счета",
            "B) Наблюдаю, не предпринимаю действий",
            "C) Рассматриваю как возможность",
        ],
    },
    {
        "id": 11,
        "text": "Как вы оцениваете свою психологическую устойчивость к потерям?",
        "options": ["A) Слабая", "B) Средняя", "C) Высокая"],
    },
]


def convert_llm_data_to_risk_factors(
    term_months: float, capital: float
) -> Dict[str, str]:
    """Конвертирует данные из LLM в факторы для риск-профиля"""
    # Определяем горизонт инвестирования
    if term_months <= 36:  # до 3 лет
        horizon = "A"  # До 3 лет
    elif term_months <= 84:  # до 7 лет
        horizon = "B"  # 3–7 лет
    else:
        horizon = "C"  # Более 7 лет

    # Определяем размер капитала
    if capital < 1000000:  # менее 1 млн
        capital_size = "A"
    elif capital <= 5000000:  # 1-5 млн
        capital_size = "B"
    else:  # более 5 млн
        capital_size = "C"

    return {"horizon": horizon, "capital_size": capital_size}


def get_llm_risk_factors(user_id: str, cache) -> Dict:
    """Получает факторы риска из данных LLM для пользователя"""
    goal_data = cache.get_json(f"user:{user_id}:llm_goal")
    if not goal_data:
        raise ValueError(f"Данные цели не найдены для пользователя {user_id}")

    return convert_llm_data_to_risk_factors(
        term_months=goal_data["term"], capital=goal_data["capital"]
    )


def check_all_contradictions(answers: dict, llm_data: Dict = None) -> List[Dict]:
    """Проверка противоречий с учетом данных из LLM"""
    contradictions = []

    if llm_data:
        horizon = llm_data.get("horizon")
        capital_size = llm_data.get("capital_size")

        if horizon == "A" and answers.get(8) == "C":
            contradictions.append(
                {
                    "code": "short_term_high_return",
                    "question": "Вы планируете инвестировать на короткий срок "
                    + "(до 3 лет), но ожидаете высокую доходность. Что для вас важнее?",
                    "options": [
                        "A) Сохранить срок, снизить ожидания по доходности",
                        "B) Готов продлить срок для достижения высокой доходности",
                    ],
                }
            )

        if capital_size == "A" and answers.get(8) == "C":
            contradictions.append(
                {
                    "code": "small_capital_high_return",
                    "question": "При небольшом стартовом капитале вы ожидаете "
                    + "высокую доходность. "
                    + "Рекомендуем начать с умеренных стратегий. Согласны?",
                    "options": [
                        "A) Да, начну с умеренного риска",
                        "B) Нет, готов к высокому риску",
                    ],
                }
            )

        if answers.get(1) == "A" and capital_size == "C":
            contradictions.append(
                {
                    "code": "beginner_large_capital",
                    "question": "Вы начинающий инвестор с крупным капиталом. "
                    + "Рекомендуем начать с умеренных стратегий. Согласны?",
                    "options": [
                        "A) Да, начну с умеренного риска",
                        "B) Нет, готов к более агрессивной стратегии",
                    ],
                }
            )

    if answers.get(6) == "A" and answers.get(7) == "C":
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

    if answers.get(1) == "A" and answers.get(2) == "C":
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

    return contradictions


def apply_restrictions(
    conservative: int,
    moderate: int,
    aggressive: int,
    answers_map: dict,
    llm_data: Dict = None,
):
    """Применение ограничивающих условий с учетом LLM данных"""

    # Нет опыта → максимум умеренный
    if answers_map.get(1) == "A":
        aggressive = min(aggressive, moderate)

    # Просадка ≤ -10% → консервативный
    if answers_map.get(6) == "A":
        aggressive = 0
        moderate = 0
        conservative = max(conservative, 8)

    # Страх потерь → консервативный
    if answers_map.get(9) == "A" or answers_map.get(7) == "A":
        aggressive = 0
        moderate = 0
        conservative = max(conservative, 8)

    # Если есть данные из LLM, применяем дополнительные ограничения
    if llm_data:
        capital_size = llm_data.get("capital_size")
        horizon = llm_data.get("horizon")

        # Начинающий + крупный капитал → максимум умеренный
        if answers_map.get(1) == "A" and capital_size == "C":
            aggressive = min(aggressive, moderate)

        # Короткий горизонт → максимум умеренный
        if horizon == "A":
            aggressive = min(aggressive, moderate)

    return conservative, moderate, aggressive


def determine_profile_v2(
    conservative: int,
    moderate: int,
    aggressive: int,
    answers_map: dict,
    llm_data: Dict = None,
) -> str:
    """Определение профиля с учетом LLM данных"""

    conservative, moderate, aggressive = apply_restrictions(
        conservative, moderate, aggressive, answers_map, llm_data
    )

    if aggressive >= 15:
        return "Агрессивный"
    elif moderate >= 8 and moderate <= 14:
        return "Умеренный"
    else:
        return "Консервативный"


def calculate_profile_v2(
    answers: List[RiskAnswer], llm_data: Dict = None
) -> RiskProfileResult:
    """Основной расчет профиля"""
    answers_map = {a.question_id: a.answer.strip()[0].upper() for a in answers}

    conservative = moderate = aggressive = 0

    scoring = {
        # Блок 1 – Опыт и вовлечённость
        1: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        2: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        3: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        # Блок 2 – Финансовое положение
        4: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        5: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        # Блок 3 – Отношение к риску
        6: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        7: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        8: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        # Блок 4 – Эмоциональная устойчивость
        9: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        10: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
        11: {"A": ("cons", 2), "B": ("mod", 1), "C": ("agr", 3)},
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

    profile = determine_profile_v2(
        conservative, moderate, aggressive, answers_map, llm_data
    )

    horizon_mapping = {"A": "До 3 лет", "B": "3–7 лет", "C": "Более 7 лет"}
    investment_horizon = horizon_mapping.get(answers_map.get(1))

    if llm_data:
        investment_horizon = horizon_mapping.get(llm_data.get("horizon"))

    return RiskProfileResult(
        profile=profile,
        conservative_score=conservative,
        moderate_score=moderate,
        aggressive_score=aggressive,
        investment_horizon=investment_horizon,
    )


def calculate_profile_v2_with_clarifications(
    answers: List[RiskAnswer],
    clarification_answers: List[Dict[str, str]],
    llm_data: Dict = None,
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
        [RiskAnswer(question_id=k, answer=v) for k, v in answers_map.items()], llm_data
    )
