from sqlalchemy.orm import Session

from app.repositories import portfolio_repository
from app.schemas.portfolio import PortfolioCreate


def list_portfolios(db: Session, user_id: int):
    return portfolio_repository.get_portfolios(db, user_id)


def add_portfolio(db: Session, user_id: int, portfolio_in: PortfolioCreate):
    return portfolio_repository.create_portfolio(db, user_id, portfolio_in)


def remove_portfolio(db: Session, portfolio_id: int):
    return portfolio_repository.delete_portfolio(db, portfolio_id)
