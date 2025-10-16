from sqlalchemy.orm import Session

from app.models.portfolio import Portfolio
from app.models.portfolio_asset import PortfolioAsset
from app.schemas.portfolio import PortfolioCreate


def get_portfolios(db: Session, user_id: int):
    return db.query(Portfolio).filter(Portfolio.user_id == user_id).all()


def get_portfolio(db: Session, portfolio_id: int):
    return db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()


def create_portfolio(
    db: Session, user_id: int, portfolio_in: PortfolioCreate
) -> Portfolio:
    portfolio = Portfolio(
        user_id=user_id,
        investment_amount=portfolio_in.investment_amount,
        risk_profile=portfolio_in.risk_profile,
        time_horizon=portfolio_in.time_horizon,
    )
    db.add(portfolio)
    db.flush()

    for asset in portfolio_in.assets:
        pa = PortfolioAsset(
            portfolio_id=portfolio.id,
            asset_id=asset.asset_id,
            weight=asset.weight,
        )
        db.add(pa)

    db.commit()
    db.refresh(portfolio)
    return portfolio


def delete_portfolio(db: Session, portfolio_id: int) -> bool:
    portfolio = get_portfolio(db, portfolio_id)
    if not portfolio:
        return False
    db.delete(portfolio)
    db.commit()
    return True
