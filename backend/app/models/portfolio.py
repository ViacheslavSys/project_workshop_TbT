from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    portfolio_name = Column(String(100), nullable=False, default="Основной портфель")

    # Основные параметры расчета
    target_amount = Column(Float, nullable=False)
    initial_capital = Column(Float, nullable=False, default=0)
    investment_term_months = Column(Integer, nullable=False)
    annual_inflation_rate = Column(Float, nullable=False)
    future_value_with_inflation = Column(Float, nullable=False)

    # Характеристики портфеля
    risk_profile = Column(String(50), nullable=False)
    time_horizon = Column(String(20), nullable=False)
    smart_goal = Column(Text)
    total_investment = Column(Float, nullable=False)
    expected_portfolio_return = Column(Float, nullable=False)

    # Метки времени
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)

    # Связи
    user = relationship("User", back_populates="portfolios")
    monthly_payment = relationship(
        "MonthlyPayment",
        back_populates="portfolio",
        uselist=False,
        cascade="all, delete-orphan",
    )
    portfolio_compositions = relationship(
        "PortfolioComposition", back_populates="portfolio", cascade="all, delete-orphan"
    )
    step_by_step_plan = relationship(
        "StepByStepPlan",
        back_populates="portfolio",
        uselist=False,
        cascade="all, delete-orphan",
    )
    calculation_explanations = relationship(
        "PortfolioCalculationExplanation",
        back_populates="portfolio",
        cascade="all, delete-orphan",
    )


class MonthlyPayment(Base):
    __tablename__ = "monthly_payments"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(
        Integer, ForeignKey("portfolios.id"), nullable=False, unique=True
    )
    monthly_payment = Column(Float, nullable=False)
    future_capital = Column(Float, nullable=False)
    total_months = Column(Integer, nullable=False)
    monthly_rate = Column(Float, nullable=False)
    annuity_factor = Column(Float, nullable=False)

    portfolio = relationship("Portfolio", back_populates="monthly_payment")


class PortfolioComposition(Base):
    __tablename__ = "portfolio_compositions"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    asset_type = Column(String(50), nullable=False)  # 'акции', 'облигации', etc.
    target_weight = Column(Float, nullable=False)
    actual_weight = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)

    portfolio = relationship("Portfolio", back_populates="portfolio_compositions")
    asset_allocations = relationship(
        "AssetAllocation",
        back_populates="portfolio_composition",
        cascade="all, delete-orphan",
    )


class AssetAllocation(Base):
    __tablename__ = "asset_allocations"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_composition_id = Column(
        Integer, ForeignKey("portfolio_compositions.id"), nullable=False
    )
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)

    # Только уникальные для портфеля данные
    quantity = Column(Integer, nullable=False)
    target_weight = Column(Float, nullable=False)  # Вес в этом портфеле
    purchase_price = Column(Float, nullable=False)  # Цена на момент создания портфеля

    # Связи
    asset = relationship("Asset", lazy="joined")
    portfolio_composition = relationship(
        "PortfolioComposition", back_populates="asset_allocations"
    )


class StepByStepPlan(Base):
    __tablename__ = "step_by_step_plans"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(
        Integer, ForeignKey("portfolios.id"), nullable=False, unique=True
    )
    generated_at = Column(DateTime, nullable=False)
    total_steps = Column(Integer, nullable=False)

    portfolio = relationship("Portfolio", back_populates="step_by_step_plan")
    plan_steps = relationship(
        "PlanStep", back_populates="step_by_step_plan", cascade="all, delete-orphan"
    )


class PlanStep(Base):
    __tablename__ = "plan_steps"

    id = Column(Integer, primary_key=True, index=True)
    step_by_step_plan_id = Column(
        Integer, ForeignKey("step_by_step_plans.id"), nullable=False
    )
    step_number = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)

    step_by_step_plan = relationship("StepByStepPlan", back_populates="plan_steps")
    step_actions = relationship(
        "StepAction", back_populates="plan_step", cascade="all, delete-orphan"
    )


class StepAction(Base):
    __tablename__ = "step_actions"

    id = Column(Integer, primary_key=True, index=True)
    plan_step_id = Column(Integer, ForeignKey("plan_steps.id"), nullable=False)
    action_text = Column(Text, nullable=False)
    action_order = Column(Integer, nullable=False)  # Порядок действий внутри шага

    plan_step = relationship("PlanStep", back_populates="step_actions")


class PortfolioCalculationExplanation(Base):
    __tablename__ = "portfolio_calculation_explanations"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    explanation_text = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    portfolio = relationship("Portfolio", back_populates="calculation_explanations")
