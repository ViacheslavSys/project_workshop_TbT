from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import user_repository
from app.schemas.user import UserCreate, UserUpdate


async def list_users(db: AsyncSession, skip: int = 0, limit: int = 100):
    return await user_repository.get_users(db, skip, limit)


async def list_active_users(db: AsyncSession):
    return await user_repository.get_active_users(db)


async def get_user_by_id(db: AsyncSession, user_id: int):
    """Get user by ID with proper error handling"""
    user = await user_repository.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def add_user(db: AsyncSession, user_in: UserCreate):
    """Create new user"""
    try:
        return await user_repository.create_user(db, user_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


async def edit_user(db: AsyncSession, user_id: int, user_in: UserUpdate):
    """Update user information"""
    user = await user_repository.update_user(db, user_id, user_in)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def deactivate_user(db: AsyncSession, user_id: int):
    """Deactivate user (soft delete)"""
    success = await user_repository.deactivate_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deactivated successfully"}


async def activate_user(db: AsyncSession, user_id: int):
    """Activate user"""
    success = await user_repository.activate_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User activated successfully"}


async def authenticate_user(db: AsyncSession, username: str, password: str):
    """Authenticate user by username and password"""
    user = await user_repository.authenticate_user(db, username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user
