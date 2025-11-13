from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.portfolio import (
    Portfolio, 
    MonthlyPayment, 
    PortfolioComposition, 
    AssetAllocation,
    StepByStepPlan, 
    PlanStep, 
    StepAction
)
from app.models.asset import Asset
from app.schemas.portfolio import PortfolioCalculationResponse, PortfolioCreate

class PortfolioRepository:
    def __init__(self, db_session: Session):
        self.db_session = db_session

    def create_portfolio(self, portfolio_data: PortfolioCalculationResponse, user_id: int, portfolio_name: str = "Основной портфель") -> Portfolio:
        """Создание портфеля в базе данных"""
        
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
            expected_portfolio_return=portfolio_data.recommendation.expected_portfolio_return
        )
        
        self.db_session.add(portfolio)
        self.db_session.flush()  # Получаем ID портфеля
        
        # Создаем данные по ежемесячному платежу
        monthly_payment = MonthlyPayment(
            portfolio_id=portfolio.id,
            monthly_payment=portfolio_data.recommendation.monthly_payment_detail.monthly_payment,
            future_capital=portfolio_data.recommendation.monthly_payment_detail.future_capital,
            total_months=portfolio_data.recommendation.monthly_payment_detail.total_months,
            monthly_rate=portfolio_data.recommendation.monthly_payment_detail.monthly_rate,
            annuity_factor=portfolio_data.recommendation.monthly_payment_detail.annuity_factor
        )
        
        self.db_session.add(monthly_payment)
        
        # Создаем композиции портфеля и распределения активов
        for comp in portfolio_data.recommendation.composition:
            portfolio_composition = PortfolioComposition(
                portfolio_id=portfolio.id,
                asset_type=comp.asset_type,
                target_weight=comp.target_weight,
                actual_weight=comp.actual_weight,
                amount=comp.amount
            )
            
            self.db_session.add(portfolio_composition)
            self.db_session.flush()  # Получаем ID композиции
            
            # Добавляем распределения активов
            for asset_alloc in comp.assets:
                # Находим asset_id по тикеру
                asset = self.db_session.query(Asset).filter(
                    Asset.ticker == asset_alloc.ticker
                ).first()
                
                if asset:
                    asset_allocation = AssetAllocation(
                        portfolio_composition_id=portfolio_composition.id,
                        asset_id=asset.id,
                        quantity=asset_alloc.quantity,
                        target_weight=asset_alloc.weight,
                        purchase_price=asset_alloc.price
                    )
                    self.db_session.add(asset_allocation)
        
        if portfolio_data.recommendation.step_by_step_plan:
            step_plan = StepByStepPlan(
                portfolio_id=portfolio.id,
                generated_at=portfolio_data.recommendation.step_by_step_plan.generated_at,
                total_steps=portfolio_data.recommendation.step_by_step_plan.total_steps
            )
            
            self.db_session.add(step_plan)
            self.db_session.flush()
            
            # Добавляем шаги плана
            for step in portfolio_data.recommendation.step_by_step_plan.steps:
                plan_step = PlanStep(
                    step_by_step_plan_id=step_plan.id,
                    step_number=step.step_number,
                    title=step.title,
                    description=step.description
                )
                
                self.db_session.add(plan_step)
                self.db_session.flush()
                
                # Добавляем действия для шага
                for action_order, action_text in enumerate(step.actions, 1):
                    step_action = StepAction(
                        plan_step_id=plan_step.id,
                        action_text=action_text,
                        action_order=action_order
                    )
                    self.db_session.add(step_action)
        
        self.db_session.commit()
        return portfolio

    def get_user_portfolios(self, user_id: int) -> list[Portfolio]:
        """Получение всех портфелей пользователя"""
        return self.db_session.query(Portfolio).filter(
            Portfolio.user_id == user_id,
            Portfolio.is_active == True
        ).all()

    def get_portfolio_by_id(self, portfolio_id: int, user_id: int) -> Portfolio:
        """Получение конкретного портфеля пользователя"""
        return self.db_session.query(Portfolio).filter(
            and_(
                Portfolio.id == portfolio_id,
                Portfolio.user_id == user_id,
                Portfolio.is_active == True
            )
        ).first()

    def deactivate_portfolio(self, portfolio_id: int, user_id: int) -> bool:
        """Деактивация портфеля"""
        portfolio = self.get_portfolio_by_id(portfolio_id, user_id)
        if portfolio:
            portfolio.is_active = False
            self.db_session.commit()
            return True
        return False