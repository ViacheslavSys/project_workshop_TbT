from app.core.database import Base  # noqa: F401
from app.models.asset import Asset  # noqa: F401
from app.models.inflation import Inflation  # noqa: F401
from app.models.portfolio import (  # noqa: F401
    AssetAllocation,
    MonthlyPayment,
    PlanStep,
    Portfolio,
    PortfolioComposition,
    StepAction,
    StepByStepPlan,
)
from app.models.user import User  # noqa: F401

# Эти импорты нужны для Alembic чтобы обнаружить модели
