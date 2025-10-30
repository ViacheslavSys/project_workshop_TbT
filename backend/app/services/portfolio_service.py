from typing import Dict, List, Tuple

from sqlalchemy.orm import Session

from app.core.redis_cache import cache
from app.repositories.asset_repository import AssetRepository
from app.repositories.inflation_repository import InflationRepository
from app.schemas.portfolio import (
    AssetAllocation,
    MonthlyPaymentDetail,
    PortfolioCalculationResponse,
    PortfolioComposition,
    PortfolioRecommendation,
)


class PortfolioService:
    def __init__(self, db_session: Session):
        self.db_session = db_session
        self.inflation_repo = InflationRepository()
        self.asset_repo = AssetRepository()

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
        """
        Расчет ежемесячного платежа с учётом доходности и стартового капитала
        """
        # Проверяем входные параметры
        if portfolio_return is None:
            portfolio_return = 0.08

        if portfolio_return <= 0:
            portfolio_return = 0.08

        # Расчет месячной ставки
        monthly_rate = (1 + portfolio_return) ** (1 / 12) - 1
        months = years * 12

        # Защита от деления на ноль
        if abs(monthly_rate) < 1e-10:
            annuity_factor = months
        else:
            annuity_factor = ((1 + monthly_rate) ** months - 1) / monthly_rate

        if start_capital > 0:
            future_capital = start_capital * (1 + portfolio_return) ** years
            monthly_payment = max(0, (future_goal - future_capital) / annuity_factor)
        else:
            future_capital = 0
            monthly_payment = future_goal / annuity_factor

        if monthly_payment < 0:
            monthly_payment = 0

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

        allocation = rules.get(risk_profile, {}).get(
            horizon, rules['moderate']['medium']
        )
        return allocation

    def select_stocks_by_risk(
        self, risk_profile: str, stock_budget: float
    ) -> List[AssetAllocation]:
        """Подбор акций по риск-профилю"""

        all_stocks = self.asset_repo.get_assets_by_type(self.db_session, 'акция')

        strategies = {
            'conservative': ['SBER', 'GAZP', 'LKOH', 'VTBR'],
            'moderate': ['SBER', 'GAZP', 'LKOH', 'VTBR', 'GMKN', 'ROSN', 'MGNT'],
            'aggressive': [
                'SBER',
                'GAZP',
                'LKOH',
                'VTBR',
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
    ) -> List[AssetAllocation]:
        """Расчет количества акций для покупки"""

        result = []
        for i, stock in enumerate(stocks):
            if i < len(weights) and stock.price_now > 0:
                quantity = int((stock_budget * weights[i]) / stock.price_now)
                if quantity > 0:
                    result.append(
                        AssetAllocation(
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
    ) -> List[AssetAllocation]:
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
    ) -> List[AssetAllocation]:
        """Расчет количества облигаций для покупки"""

        if not bonds:
            return []

        result = []
        for i, bond in enumerate(bonds):
            if i < len(weights) and bond.price_now > 0:
                quantity = int((bond_budget * weights[i]) / bond.price_now)
                if quantity > 0:
                    result.append(
                        AssetAllocation(
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
    ) -> List[AssetAllocation]:
        """Подбор ETF активов (золото, недвижимость)"""

        etf_assets = self.asset_repo.get_assets_by_type(self.db_session, asset_type)

        if not etf_assets or budget <= 0:
            return []

        asset = etf_assets[0]
        if asset.price_now > 0:
            quantity = int(budget / asset.price_now)
            if quantity > 0:
                return [
                    AssetAllocation(
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
        )

    def calculate_portfolio(self, user_id: str) -> PortfolioCalculationResponse:
        """Основной метод расчета полного инвестиционного плана"""

        goal_data = cache.get_json(f"user:{user_id}:llm_goal")

        if not goal_data:
            raise ValueError(
                "Данные цели не найдены. Сначала определите цель через диалог."
            )

        term_months = goal_data["term"]
        target_amount = goal_data["sum"]
        initial_capital = goal_data["capital"]
        smart_goal = goal_data["reason"]
        risk_profile = goal_data.get("risk_profile", "moderate")

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

        return PortfolioCalculationResponse(
            target_amount=target_amount,
            initial_capital=initial_capital,
            investment_term_months=term_months,
            annual_inflation_rate=inflation_rate,
            future_value_with_inflation=future_value,
            recommendation=recommendation,
        )
