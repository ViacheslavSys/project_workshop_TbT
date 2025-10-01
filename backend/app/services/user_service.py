from sqlalchemy.orm import Session

from app.repositories import user_repository
from app.schemas.user import UserCreate, UserUpdate


def list_users(db: Session):
    return user_repository.get_users(db)


def add_user(db: Session, user_in: UserCreate):
    return user_repository.create_user(db, user_in)


def edit_user(db: Session, user_id: int, user_in: UserUpdate):
    return user_repository.update_user(db, user_id, user_in)


def remove_user(db: Session, user_id: int):
    return user_repository.delete_user(db, user_id)


def get_user_by_username(db: Session, username: str):
    return user_repository.get_user_by_username(db, username)
