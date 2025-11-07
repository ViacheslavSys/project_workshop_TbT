from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories import user_repository
from app.schemas.user import UserCreate, UserUpdate


def list_users(db: Session, skip: int = 0, limit: int = 100):
    return user_repository.get_users(db, skip, limit)


def list_active_users(db: Session):
    return user_repository.get_active_users(db)


def get_user_by_id(db: Session, user_id: int):
    """Get user by ID with proper error handling"""
    user = user_repository.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def add_user(db: Session, user_in: UserCreate):
    """Create new user"""
    try:
        return user_repository.create_user(db, user_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def edit_user(db: Session, user_id: int, user_in: UserUpdate):
    """Update user information"""
    user = user_repository.update_user(db, user_id, user_in)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def deactivate_user(db: Session, user_id: int):
    """Deactivate user (soft delete)"""
    success = user_repository.deactivate_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deactivated successfully"}


def activate_user(db: Session, user_id: int):
    """Activate user"""
    success = user_repository.activate_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User activated successfully"}


def authenticate_user(db: Session, username: str, password: str):
    """Authenticate user by username and password"""
    user = user_repository.authenticate_user(db, username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user
