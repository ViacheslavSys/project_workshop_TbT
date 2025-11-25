from datetime import datetime
from typing import Dict, List, Tuple

from sqlalchemy.orm import Session

from app.core.redis_cache import cache
from app.models.asset import Asset
from app.models.portfolio import AssetAllocation as AssetAllocationModel
from app.models.portfolio import MonthlyPayment
from app.models.portfolio import PlanStep as PlanStepModel
from app.models.portfolio import Portfolio
from app.models.portfolio import PortfolioComposition as PortfolioCompositionModel
from app.models.portfolio import StepAction as StepActionModel
from app.models.portfolio import StepByStepPlan as StepByStepPlanModel
from app.repositories.asset_repository import AssetRepository
from app.repositories.inflation_repository import InflationRepository
from app.repositories.portfolio_repository import PortfolioRepository
from app.schemas.portfolio import AssetAllocation as AssetAllocationSchema
from app.schemas.portfolio import (
    MonthlyPaymentDetail,
    PlanStep,
    PortfolioCalculationResponse,
    PortfolioComposition,
    PortfolioRecommendation,
    PortfolioSummary,
    StepByStepPlan,
)


class PortfolioService:
    def __init__(self, db_session: Session):
        self.db_session = db_session
        self.inflation_repo = InflationRepository()
        self.asset_repo = AssetRepository()
        self.portfolio_repo = PortfolioRepository(db_session)

    def calculate_future_value_with_inflation(
        self, goal_sum: float, term_months: int
    ) -> Tuple[float, float]:
        """Расчет будущей стоимости с учетом инфляции"""

        latest_inflation = self.inflation_repo.get_latest(self.db_session)

        if not latest_inflation:
            annual_inflation_rate = 0.08
        else:
            annual_inflation_rate = latest_inflation.value / 100

        total_years = term_months / 12
        future_value = goal_sum * ((1 + annual_inflation_rate) ** total_years)

        return future_value, annual_inflation_rate

    def calculate_monthly_payment(
        self,
        future_goal: float,
        years: int,
        portfolio_return: float,
        start_capital: float = 0,
    ) -> MonthlyPaymentDetail:
        # Проверяем входные параметры
        if portfolio_return is None or portfolio_return <= 0:
            portfolio_return = 0.08

        # Расчет месячной ставки
        monthly_rate = (1 + portfolio_return) ** (1 / 12) - 1
        months = years * 12

        # ✅ ИСПРАВЛЕНИЕ: ВСЕГДА используем точную формулу аннуитета
        annuity_factor = ((1 + monthly_rate) ** months - 1) / monthly_rate

        # ✅ ИСПРАВЛЕНИЕ: Стартовый капитал растет по МЕСЯЧНОЙ ставке
        if start_capital > 0:
            future_capital = start_capital * (1 + monthly_rate) ** months
        else:
            future_capital = 0

        # ✅ ИСПРАВЛЕНИЕ: Проверка нереальных сценариев
        if future_capital >= future_goal:
            monthly_payment = 0
        else:
            monthly_payment = (future_goal - future_capital) / annuity_factor

        monthly_payment = max(0, monthly_payment)

        return MonthlyPaymentDetail(
            monthly_payment=monthly_payment,
            future_capital=future_capital,
            total_months=months,
            monthly_rate=monthly_rate,
            annuity_factor=annuity_factor,
        )

    def get_portfolio_allocation(
        self, risk_profile: str, term_years: float
    ) -> Dict[str, float]:
        """Определение распределения активов по риск-профилю и сроку"""

        profile_mapping = {
            'Консервативный': 'conservative',
            'Умеренный': 'moderate',
            'Агрессивный': 'aggressive',
        }

        risk_profile_en = profile_mapping.get(risk_profile, risk_profile.lower())

        print(f"📊 [DEBUG] Профиль риска: {risk_profile} -> {risk_profile_en}")

        if term_years <= 3:
            horizon = 'short'
        elif term_years <= 7:
            horizon = 'medium'
        else:
            horizon = 'long'

        print(f"📊 [DEBUG] Горизонт инвестирования: {horizon}")

        rules = {
            'conservative': {
                'short': {
                    'акции': 0.1,
                    'облигации': 0.7,
                    'золото': 0.1,
                    'недвижимость': 0.1,
                },
                'medium': {
                    'акции': 0.2,
                    'облигации': 0.65,
                    'золото': 0.08,
                    'недвижимость': 0.07,
                },
                'long': {
                    'акции': 0.45,
                    'облигации': 0.45,
                    'золото': 0.05,
                    'недвижимость': 0.05,
                },
            },
            'moderate': {
                'short': {
                    'акции': 0.1,
                    'облигации': 0.75,
                    'золото': 0.08,
                    'недвижимость': 0.07,
                },
                'medium': {
                    'акции': 0.4,
                    'облигации': 0.5,
                    'золото': 0.05,
                    'недвижимость': 0.05,
                },
                'long': {
                    'акции': 0.55,
                    'облигации': 0.4,
                    'золото': 0.03,
                    'недвижимость': 0.02,
                },
            },
            'aggressive': {
                'short': {
                    'акции': 0.45,
                    'облигации': 0.45,
                    'золото': 0.05,
                    'недвижимость': 0.05,
                },
                'medium': {
                    'акции': 0.55,
                    'облигации': 0.4,
                    'золото': 0.03,
                    'недвижимость': 0.02,
                },
                'long': {
                    'акции': 0.60,
                    'облигации': 0.35,
                    'золото': 0.03,
                    'недвижимость': 0.02,
                },
            },
        }

        allocation = rules.get(risk_profile_en, {}).get(
            horizon, rules['moderate']['medium']
        )
        return allocation

    def select_stocks_by_risk(
        self, risk_profile: str, stock_budget: float
    ) -> List[AssetAllocationSchema]:  # ← Используйте Schema
        """Подбор акций по риск-профилю"""

        all_stocks = self.asset_repo.get_assets_by_type(self.db_session, 'акция')

        strategies = {
            'conservative': ['SBER', 'GAZP', 'LKOH'],
            'moderate': ['SBER', 'GAZP', 'LKOH', 'GMKN', 'ROSN', 'MGNT'],
            'aggressive': [
                'SBER',
                'GAZP',
                'LKOH',
                'GMKN',
                'ROSN',
                'MGNT',
                'TCSG',
                'TATN',
                'NLMK',
            ],
        }

        selected_tickers = strategies.get(risk_profile, strategies['moderate'])

        selected_stocks = [s for s in all_stocks if s.ticker in selected_tickers]

        if not selected_stocks:
            selected_stocks = all_stocks[: min(4, len(all_stocks))]

        weights = [1.0 / len(selected_stocks)] * len(selected_stocks)

        return self.calculate_stock_quantities(selected_stocks, weights, stock_budget)

    def calculate_stock_quantities(
        self, stocks: List, weights: List[float], stock_budget: float
    ) -> List[AssetAllocationSchema]:  # ← Используйте Schema
        """Расчет количества акций для покупки"""

        result = []
        for i, stock in enumerate(stocks):
            if i < len(weights) and stock.price_now > 0:
                quantity = int((stock_budget * weights[i]) / stock.price_now)
                if quantity > 0:
                    result.append(
                        AssetAllocationSchema(  # ← Используйте Schema
                            name=stock.name,
                            type='акции',
                            ticker=stock.ticker,
                            quantity=quantity,
                            price=stock.price_now,
                            weight=weights[i],
                            amount=quantity * stock.price_now,
                            expected_return=stock.yield_value,
                        )
                    )

        return result

    def select_bonds_by_term(
        self, term_years: float, bond_budget: float
    ) -> List[AssetAllocationSchema]:  # ← Используйте Schema
        """Подбор облигаций по сроку инвестирования"""

        all_bonds = self.asset_repo.get_assets_by_type(self.db_session, 'облигация')

        if not all_bonds:
            return []

        if term_years <= 1:
            selected_bonds = [b for b in all_bonds if 'краткосрочная' in b.type]

            weights = [0.6, 0.4] if len(selected_bonds) >= 2 else [1.0]
        elif term_years <= 5:
            short_term = [b for b in all_bonds if 'краткосрочная' in b.type]
            medium_term = [b for b in all_bonds if 'среднесрочная' in b.type]
            selected_bonds = (short_term[:1] + medium_term[:2])[:3]

            weights = (
                [0.3, 0.35, 0.35]
                if len(selected_bonds) == 3
                else [1.0 / len(selected_bonds)] * len(selected_bonds)
            )
        else:
            short_term = [b for b in all_bonds if 'краткосрочная' in b.type]
            medium_term = [b for b in all_bonds if 'среднесрочная' in b.type]
            long_term = [b for b in all_bonds if 'долгосрочная' in b.type]
            selected_bonds = (short_term[:1] + medium_term[:1] + long_term[:1])[:3]

            weights = (
                [0.2, 0.3, 0.5]
                if len(selected_bonds) == 3
                else [1.0 / len(selected_bonds)] * len(selected_bonds)
            )

        return self.calculate_bond_quantities(selected_bonds, weights, bond_budget)

    def calculate_bond_quantities(
        self, bonds: List, weights: List[float], bond_budget: float
    ) -> List[AssetAllocationSchema]:  # ← Используйте Schema
        """Расчет количества облигаций для покупки"""

        if not bonds:
            return []

        result = []
        for i, bond in enumerate(bonds):
            if i < len(weights) and bond.price_now > 0:
                quantity = int((bond_budget * weights[i]) / bond.price_now)
                if quantity > 0:
                    result.append(
                        AssetAllocationSchema(  # ← Используйте Schema
                            name=bond.name,
                            type='облигации',
                            ticker=bond.ticker,
                            quantity=quantity,
                            price=bond.price_now,
                            weight=weights[i],
                            amount=quantity * bond.price_now,
                            expected_return=bond.yield_value,
                        )
                    )

        return result

    def select_etf_assets(
        self, asset_type: str, budget: float
    ) -> List[AssetAllocationSchema]:  # ← Используйте Schema
        """Подбор ETF активов (золото, недвижимость)"""

        etf_assets = self.asset_repo.get_assets_by_type(self.db_session, asset_type)

        if not etf_assets or budget <= 0:
            return []

        asset = etf_assets[0]
        if asset.price_now > 0:
            quantity = int(budget / asset.price_now)
            if quantity > 0:
                return [
                    AssetAllocationSchema(  # ← Используйте Schema
                        name=asset.name,
                        type=asset_type,
                        ticker=asset.ticker,
                        quantity=quantity,
                        price=asset.price_now,
                        weight=1.0,
                        amount=quantity * asset.price_now,
                        expected_return=asset.yield_value,
                    )
                ]

        return []

    def calculate_expected_portfolio_return(
        self, composition: List[PortfolioComposition]
    ) -> float:
        """Расчет ожидаемой доходности портфеля"""

        total_return = 0.0
        total_weight = 0.0

        for i, comp in enumerate(composition):

            type_return = 0.0
            type_weight = 0.0

            for j, asset in enumerate(comp.assets):

                if asset.expected_return is not None and asset.expected_return > 0:
                    asset_contribution = asset.weight * asset.expected_return
                    type_return += asset_contribution
                    type_weight += asset.weight

            if type_weight > 0:
                type_avg_return = type_return / type_weight
                total_return += type_avg_return * comp.target_weight
                total_weight += comp.target_weight

        if total_weight == 0 or total_return <= 0:
            return 0.08

        final_return = total_return

        return final_return

    def build_portfolio_recommendation(
        self,
        future_value: float,
        initial_capital: float,
        term_months: int,
        inflation_rate: float,
        risk_profile: str,
        smart_goal: str,
    ) -> PortfolioRecommendation:
        """Построение полной рекомендации по портфелю"""

        term_years = term_months / 12

        allocation = self.get_portfolio_allocation(risk_profile, term_years)

        composition = []
        total_investment = 0

        for asset_type, target_weight in allocation.items():
            budget = future_value * target_weight

            if asset_type == 'акции':
                assets = self.select_stocks_by_risk(risk_profile, budget)
            elif asset_type == 'облигации':
                assets = self.select_bonds_by_term(term_years, budget)
            elif asset_type == 'золото':
                assets = self.select_etf_assets('золото', budget)
            elif asset_type == 'недвижимость':
                assets = self.select_etf_assets('недвижимость', budget)
            else:
                assets = []

            actual_amount = sum(asset.amount for asset in assets)
            actual_weight = actual_amount / future_value if future_value > 0 else 0

            composition.append(
                PortfolioComposition(
                    asset_type=asset_type,
                    target_weight=target_weight,
                    actual_weight=actual_weight,
                    amount=actual_amount,
                    assets=assets,
                )
            )

            total_investment += actual_amount

        expected_return = self.calculate_expected_portfolio_return(composition)

        monthly_payment_detail = self.calculate_monthly_payment(
            future_goal=future_value,
            years=term_years,
            portfolio_return=expected_return,
            start_capital=initial_capital,
        )

        # Создаем временный объект рекомендации для генерации плана
        temp_recommendation = PortfolioRecommendation(
            target_amount=future_value,
            initial_capital=initial_capital,
            investment_term_months=term_months,
            annual_inflation_rate=inflation_rate,
            future_value_with_inflation=future_value,
            risk_profile=risk_profile,
            time_horizon=(
                'short' if term_years <= 3 else 'medium' if term_years <= 7 else 'long'
            ),
            smart_goal=smart_goal,
            total_investment=total_investment,
            expected_portfolio_return=expected_return,
            composition=composition,
            monthly_payment_detail=monthly_payment_detail,
        )

        # 🆕 Генерация пошагового плана
        step_by_step_plan = self.generate_step_by_step_plan(
            temp_recommendation, initial_capital
        )

        # Возвращаем полную рекомендацию с планом
        return PortfolioRecommendation(
            target_amount=future_value,
            initial_capital=initial_capital,
            investment_term_months=term_months,
            annual_inflation_rate=inflation_rate,
            future_value_with_inflation=future_value,
            risk_profile=risk_profile,
            time_horizon=(
                'short' if term_years <= 3 else 'medium' if term_years <= 7 else 'long'
            ),
            smart_goal=smart_goal,
            total_investment=total_investment,
            expected_portfolio_return=expected_return,
            composition=composition,
            monthly_payment_detail=monthly_payment_detail,
            step_by_step_plan=step_by_step_plan,
        )

    def calculate_portfolio(self, user_id: str) -> PortfolioCalculationResponse:
        """Основной метод расчета полного инвестиционного плана"""

        goal_data = cache.get_json(f"user:{user_id}:llm_goal")
        profile = cache.get_json(f"user:{user_id}:risk_result")
        if not goal_data:
            raise ValueError(
                "Данные цели не найдены. Сначала определите цель через диалог."
            )

        term_months = goal_data["term"]
        target_amount = goal_data["sum"]
        initial_capital = goal_data["capital"]
        smart_goal = goal_data["reason"]
        risk_profile = profile["profile"]

        future_value, inflation_rate = self.calculate_future_value_with_inflation(
            goal_sum=target_amount, term_months=term_months
        )

        recommendation = self.build_portfolio_recommendation(
            future_value=future_value,
            initial_capital=initial_capital,
            term_months=term_months,
            inflation_rate=inflation_rate,
            risk_profile=risk_profile,
            smart_goal=smart_goal,
        )

        portfolio_response = PortfolioCalculationResponse(
            target_amount=target_amount,
            initial_capital=initial_capital,
            investment_term_months=term_months,
            annual_inflation_rate=inflation_rate,
            future_value_with_inflation=future_value,
            updated_at=datetime.now(),
            recommendation=recommendation,
        )
        portfolio_dict = portfolio_response.dict()
        if portfolio_dict.get('updated_at'):
            portfolio_dict['updated_at'] = portfolio_dict['updated_at'].isoformat()

        portfolio_key = f"user:{user_id}:portfolio"
        cache.set_json(portfolio_key, portfolio_dict, expire=360000)

        return portfolio_response

    def create_portfolio(
        self,
        portfolio_data: PortfolioCalculationResponse,
        user_id: int,
        portfolio_name: str = "Основной портфель",
    ) -> Portfolio:
        """Создание портфеля в базе данных с пошаговым планом"""

        # Создаем основной объект портфеля
        portfolio = Portfolio(
            user_id=user_id,
            portfolio_name=portfolio_name,
            target_amount=portfolio_data.target_amount,
            initial_capital=portfolio_data.initial_capital,
            investment_term_months=portfolio_data.investment_term_months,
            annual_inflation_rate=portfolio_data.annual_inflation_rate,
            future_value_with_inflation=portfolio_data.future_value_with_inflation,
            risk_profile=portfolio_data.recommendation.risk_profile,
            time_horizon=portfolio_data.recommendation.time_horizon,
            smart_goal=portfolio_data.recommendation.smart_goal,
            total_investment=portfolio_data.recommendation.total_investment,
            expected_portfolio_return=(
                portfolio_data.recommendation.expected_portfolio_return
            ),
        )

        self.db_session.add(portfolio)
        self.db_session.flush()

        # Создаем monthly_payment
        monthly_payment = MonthlyPayment(
            portfolio_id=portfolio.id,
            monthly_payment=(
                portfolio_data.recommendation.monthly_payment_detail.monthly_payment
            ),
            future_capital=(
                portfolio_data.recommendation.monthly_payment_detail.future_capital
            ),
            total_months=(
                portfolio_data.recommendation.monthly_payment_detail.total_months
            ),
            monthly_rate=(
                portfolio_data.recommendation.monthly_payment_detail.monthly_rate
            ),
            annuity_factor=(
                portfolio_data.recommendation.monthly_payment_detail.annuity_factor
            ),
        )
        self.db_session.add(monthly_payment)

        # Создаем композиции портфеля
        for comp in portfolio_data.recommendation.composition:
            portfolio_composition = PortfolioCompositionModel(  # ← Используйте Model
                portfolio_id=portfolio.id,
                asset_type=comp.asset_type,
                target_weight=comp.target_weight,
                actual_weight=comp.actual_weight,
                amount=comp.amount,
            )
            self.db_session.add(portfolio_composition)
            self.db_session.flush()

            # Добавляем распределения активов
            for asset_alloc in comp.assets:
                asset = (
                    self.db_session.query(Asset)
                    .filter(Asset.ticker == asset_alloc.ticker)
                    .first()
                )

                if asset:
                    asset_allocation = AssetAllocationModel(  # ← Используйте Model
                        portfolio_composition_id=portfolio_composition.id,
                        asset_id=asset.id,
                        quantity=asset_alloc.quantity,
                        target_weight=asset_alloc.weight,
                        purchase_price=asset_alloc.price,
                    )
                    self.db_session.add(asset_allocation)

        # Создаем пошаговый план, если он есть в данных
        if (
            portfolio_data.recommendation.step_by_step_plan
            and portfolio_data.recommendation.step_by_step_plan.steps
        ):

            try:
                generated_at = datetime.fromisoformat(
                    portfolio_data.recommendation.step_by_step_plan.generated_at
                )
            except (ValueError, AttributeError):
                generated_at = datetime.now()

            step_plan = StepByStepPlanModel(  # ← Используйте Model
                portfolio_id=portfolio.id,
                generated_at=generated_at,
                total_steps=len(portfolio_data.recommendation.step_by_step_plan.steps),
            )
            self.db_session.add(step_plan)
            self.db_session.flush()

            # Добавляем шаги плана
            for step_data in portfolio_data.recommendation.step_by_step_plan.steps:
                plan_step = PlanStepModel(  # ← Используйте Model
                    step_by_step_plan_id=step_plan.id,
                    step_number=step_data.step_number,
                    title=step_data.title,
                    description=step_data.description,
                )
                self.db_session.add(plan_step)
                self.db_session.flush()

                # Добавляем действия для шага
                for action_order, action_text in enumerate(step_data.actions, 1):
                    step_action = StepActionModel(  # ← Используйте Model
                        plan_step_id=plan_step.id,
                        action_text=action_text,
                        action_order=action_order,
                    )
                    self.db_session.add(step_action)

        self.db_session.commit()
        return portfolio

    def get_user_portfolios_from_db(self, user_id: int) -> list:
        """Получение всех портфелей пользователя из БД"""
        portfolios = self.portfolio_repo.get_user_portfolios(user_id)

        portfolio_summaries = []
        for portfolio in portfolios:
            portfolio_summaries.append(
                PortfolioSummary(
                    id=portfolio.id,
                    portfolio_name=portfolio.portfolio_name,
                    target_amount=portfolio.target_amount,
                    initial_capital=portfolio.initial_capital,
                    risk_profile=portfolio.risk_profile,
                    created_at=(
                        portfolio.created_at.isoformat()
                        if portfolio.created_at
                        else None
                    ),
                    updated_at=(
                        portfolio.updated_at.isoformat()
                        if portfolio.updated_at
                        else None
                    ),
                )
            )

        return portfolio_summaries

    def recalculate_portfolio(self, portfolio_id: int, user_id: int) -> dict:
        """Перерасчет портфеля на основе текущих цен активов"""

        portfolio = self.portfolio_repo.get_portfolio_by_id(portfolio_id, user_id)
        if not portfolio:
            raise ValueError("Портфель не найден")

        # Здесь будет логика перерасчета на основе текущих цен
        # Пока просто возвращаем информацию о портфеле
        return {
            "portfolio_id": portfolio.id,
            "portfolio_name": portfolio.portfolio_name,
        }

    def generate_step_by_step_plan(
        self, recommendation: PortfolioRecommendation, initial_capital: float
    ) -> StepByStepPlan:
        steps = []
        monthly_payment = recommendation.monthly_payment_detail.monthly_payment

        # 1. ШАГ 0: Первоначальные покупки на стартовый капитал
        if initial_capital > 0:
            # ✅ ПЕРЕСЧИТЫВАЕМ активы на реальный стартовый капитал
            total_future_value = sum(comp.amount for comp in recommendation.composition)
            initial_actions = []

            for composition in recommendation.composition:
                # Определяем долю этого типа в общем портфеле
                if total_future_value > 0:
                    type_share = composition.amount / total_future_value
                else:
                    type_share = composition.target_weight

                # Выделяем бюджет на этот тип активов
                type_budget = initial_capital * type_share

                # Распределяем бюджет между активами этого типа
                if composition.assets:
                    total_assets_weight = sum(
                        asset.weight for asset in composition.assets
                    )
                    for asset in composition.assets:
                        if total_assets_weight > 0:
                            asset_budget = type_budget * (
                                asset.weight / total_assets_weight
                            )
                            quantity = (
                                int(asset_budget / asset.price)
                                if asset.price > 0
                                else 0
                            )
                            if quantity > 0:
                                amount = quantity * asset.price
                                initial_actions.append(
                                    f"Купить {quantity} шт. "
                                    f"{asset.ticker} ({asset.name}) "
                                    f"по {asset.price:.0f} ₽ за {amount:.0f} ₽"
                                )

            steps.append(
                PlanStep(
                    step_number=0,
                    title="ПЕРВОНАЧАЛЬНЫЕ ИНВЕСТИЦИИ",
                    description=(
                        "Инвестируйте ваш стартовый капитал "
                        f"{initial_capital:.0f} ₽:"
                    ),
                    actions=initial_actions,
                )
            )

        # 2. ШАГ 1: Регулярные инвестиции (оставляем как было)
        if monthly_payment > 0:
            allocation_actions = []
            for composition in recommendation.composition:
                monthly_budget = monthly_payment * composition.target_weight
                if monthly_budget > 0:
                    allocation_actions.append(
                        f"{composition.asset_type.capitalize()}: "
                        f"{monthly_budget:.0f} ₽ "
                        f"({composition.target_weight * 100:.0f}%)"
                    )

            steps.append(
                PlanStep(
                    step_number=len(steps),
                    title="РЕГУЛЯРНЫЕ ИНВЕСТИЦИИ",
                    description=f"Каждый месяц инвестируйте {monthly_payment:.0f} ₽:",
                    actions=allocation_actions,
                )
            )

            # 3. ШАГ 2: План покупок по месяцам (оставляем как было)
            purchase_plan = self._generate_purchase_plan(
                recommendation, monthly_payment
            )
            steps.append(
                PlanStep(
                    step_number=len(steps),
                    title="ПЛАН ПОКУПОК ПО МЕСЯЦАМ",
                    description=(
                        "Рациональная последовательность " "(сначала доступные активы):"
                    ),
                    actions=purchase_plan,
                )
            )

        # 4. ШАГ 3: Контроль и корректировка (оставляем как было)
        steps.append(
            PlanStep(
                step_number=len(steps),
                title="КОНТРОЛЬ И КОРРЕКТИРОВКА",
                description="Регулярно отслеживайте ваш портфель:",
                actions=[
                    "Раз в месяц проверяйте актуальные цены",
                    "Раз в 6 месяцев rebalance портфель",
                    "При изменении риск-профиля пересмотрите стратегию",
                    (
                        f"Достигнув цели {recommendation.target_amount:.0f} ₽ "
                        "- поздравляем!"
                    ),
                ],
            )
        )

        return StepByStepPlan(
            steps=steps, generated_at=datetime.now().isoformat(), total_steps=len(steps)
        )

    def _generate_purchase_plan(
        self, recommendation: PortfolioRecommendation, monthly_payment: float
    ) -> List[str]:
        """
        тратим ВЕСЬ бюджет месяца
        """
        purchase_plan = []

        # Собираем все активы с их месячными бюджетами
        all_assets = []
        for composition in recommendation.composition:
            monthly_budget = monthly_payment * composition.target_weight
            if composition.assets:
                # Распределяем бюджет между активами этого типа
                total_assets_weight = sum(asset.weight for asset in composition.assets)
                for asset in composition.assets:
                    if total_assets_weight > 0:
                        asset_monthly_budget = monthly_budget * (
                            asset.weight / total_assets_weight
                        )
                        all_assets.append(
                            {
                                'name': f"{asset.ticker} ({asset.name})",
                                'price': asset.price,
                                'monthly_budget': asset_monthly_budget,
                            }
                        )

        # Сортируем по цене (от дешевых к дорогим)
        all_assets.sort(key=lambda x: x['price'])

        # Накопленные средства по каждому активу
        accumulated = {asset['name']: 0 for asset in all_assets}

        for month in range(1, 7):
            month_budget = monthly_payment
            month_purchases = []
            month_spent = 0

            # РАСПРЕДЕЛЯЕМ БЮДЖЕТ МЕСЯЦА
            for asset in all_assets:
                asset_name = asset['name']
                asset_price = asset['price']

                # Добавляем месячный бюджет к накоплениям
                accumulated[asset_name] += asset['monthly_budget']

                # Покупаем то, что можем
                if accumulated[asset_name] >= asset_price:
                    can_buy = int(accumulated[asset_name] // asset_price)
                    if can_buy > 0:
                        # Покупаем столько, сколько влезает в бюджет
                        max_affordable = int(
                            (month_budget - month_spent) // asset_price
                        )
                        actual_buy = min(can_buy, max_affordable)

                        if actual_buy > 0:
                            cost = actual_buy * asset_price
                            if month_spent + cost <= month_budget:
                                accumulated[asset_name] -= cost
                                month_spent += cost
                                month_purchases.append(
                                    f"Купить {actual_buy} шт. "
                                    f"{asset_name} за {cost:.0f} ₽"
                                )

            # Форматируем вывод
            if month_purchases:
                purchases_str = " + ".join(month_purchases)
                purchase_plan.append(
                    f"Месяц {month}: {purchases_str} = {month_spent:.0f} ₽"
                )
            else:
                purchase_plan.append(f"Месяц {month}: Накопить {month_budget:.0f} ₽")

        return purchase_plan

    def save_portfolio_to_db(
        self,
        session_token: str,  # session_token для Redis
        user_id: int,  # authenticated user_id из JWT
        portfolio_name: str = "Основной портфель",
    ) -> dict:
        """Сохранение портфеля из Redis в БД"""

        print(
            "🔍 [DEBUG] Начало сохранения портфеля для session_token: "
            f"{session_token}, user_id: {user_id}"
        )

        try:
            # Получаем расчет из Redis по session_token
            print(
                "🔍 [DEBUG] Получение данных из Redis для ключа: "
                f"user:{session_token}:portfolio"
            )
            portfolio_data = self.calculate_portfolio(session_token)

            # Сохраняем в БД с authenticated user_id
            print("🔍 [DEBUG] Начало сохранения в БД...")
            portfolio = self.create_portfolio(portfolio_data, user_id, portfolio_name)

            print(f"✅ [DEBUG] Портфель успешно сохранен в БД с ID: {portfolio.id}")

            return {
                "message": "Портфель успешно сохранен",
                "portfolio_id": portfolio.id,
                "portfolio_name": portfolio.portfolio_name,
            }

        except Exception as e:
            print(f"❌ [DEBUG] Ошибка в save_portfolio_to_db: {str(e)}")
            import traceback

            print(f"❌ [DEBUG] Traceback: {traceback.format_exc()}")
            raise

    def convert_db_to_response(
        self, portfolio: Portfolio
    ) -> PortfolioCalculationResponse:
        """Конвертация портфеля из БД в response схему"""

        # Восстанавливаем композицию
        composition = []
        for comp in portfolio.portfolio_compositions:
            assets = []
            for alloc in comp.asset_allocations:
                asset = alloc.asset
                assets.append(
                    AssetAllocationSchema(  # ← Используйте Schema
                        name=asset.name,
                        type=asset.type,
                        ticker=asset.ticker,
                        quantity=alloc.quantity,
                        price=alloc.purchase_price,
                        weight=alloc.target_weight,
                        amount=alloc.quantity * alloc.purchase_price,
                        expected_return=asset.yield_value,
                    )
                )

            composition.append(
                PortfolioComposition(
                    asset_type=comp.asset_type,
                    target_weight=comp.target_weight,
                    actual_weight=comp.actual_weight,
                    amount=comp.amount,
                    assets=assets,
                )
            )

        # Восстанавливаем пошаговый план
        step_plan = None
        if portfolio.step_by_step_plan:
            steps = []
            for plan_step in portfolio.step_by_step_plan.plan_steps:
                # Сортируем действия по порядку
                sorted_actions = sorted(
                    plan_step.step_actions, key=lambda x: x.action_order
                )
                actions = [action.action_text for action in sorted_actions]

                steps.append(
                    PlanStep(
                        step_number=plan_step.step_number,
                        title=plan_step.title,
                        description=plan_step.description,
                        actions=actions,
                    )
                )

            step_plan = StepByStepPlan(
                steps=steps,
                generated_at=portfolio.step_by_step_plan.generated_at.isoformat(),
                total_steps=portfolio.step_by_step_plan.total_steps,
            )

        analysis_text = None
        if portfolio.calculation_explanations:
            # Берем последний анализ (самый свежий)
            latest_analysis = sorted(
                portfolio.calculation_explanations,
                key=lambda x: x.created_at,
                reverse=True,
            )[0]
            analysis_text = latest_analysis.explanation_text

        # Восстанавливаем рекомендацию
        recommendation = PortfolioRecommendation(
            target_amount=portfolio.target_amount,
            initial_capital=portfolio.initial_capital,
            investment_term_months=portfolio.investment_term_months,
            annual_inflation_rate=portfolio.annual_inflation_rate,
            future_value_with_inflation=portfolio.future_value_with_inflation,
            risk_profile=portfolio.risk_profile,
            time_horizon=portfolio.time_horizon,
            smart_goal=portfolio.smart_goal,
            total_investment=portfolio.total_investment,
            expected_portfolio_return=portfolio.expected_portfolio_return,
            composition=composition,
            monthly_payment_detail=MonthlyPaymentDetail(
                monthly_payment=portfolio.monthly_payment.monthly_payment,
                future_capital=portfolio.monthly_payment.future_capital,
                total_months=portfolio.monthly_payment.total_months,
                monthly_rate=portfolio.monthly_payment.monthly_rate,
                annuity_factor=portfolio.monthly_payment.annuity_factor,
            ),
            step_by_step_plan=step_plan,
        )

        updated_at_str = None
        if portfolio.updated_at:
            updated_at_str = portfolio.updated_at.isoformat()
        return PortfolioCalculationResponse(
            target_amount=portfolio.target_amount,
            initial_capital=portfolio.initial_capital,
            investment_term_months=portfolio.investment_term_months,
            annual_inflation_rate=portfolio.annual_inflation_rate,
            future_value_with_inflation=portfolio.future_value_with_inflation,
            updated_at=updated_at_str,
            recommendation=recommendation,
            analysis=analysis_text,
        )

    def get_portfolio_for_analysis(
        self, portfolio_id: int, user_id: int
    ) -> PortfolioCalculationResponse:
        """Получение портфеля для анализа с проверкой прав доступа"""

        portfolio = self.portfolio_repo.get_portfolio_by_id(portfolio_id, user_id)

        if not portfolio:
            raise ValueError(f"Портфель {portfolio_id} не найден или нет доступа")

        return self.convert_db_to_response(portfolio)
