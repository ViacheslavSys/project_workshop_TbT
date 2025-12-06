from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


async def get_users(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[User]:
    """Get paginated list of users"""
    stmt = select(User).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_active_users(db: AsyncSession) -> list[User]:
    """Get only active users asynchronously"""
    stmt = select(User).where(User.is_active)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """Get user by ID asynchronously"""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    """Get user by username asynchronously"""
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Get user by email asynchronously"""
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    """Create new user with uniqueness validation asynchronously"""
    # Check username uniqueness
    existing_user = await get_user_by_username(db, user_in.username)
    if existing_user:
        raise HTTPException(
            status_code=409, detail=f"Username '{user_in.username}' already exists"
        )

    # Check email uniqueness
    existing_email = await get_user_by_email(db, user_in.email)
    if existing_email:
        raise HTTPException(
            status_code=409, detail=f"Email '{user_in.email}' already exists"
        )

    try:
        hashed_password = User.get_password_hash(user_in.password)
        user = User(
            username=user_in.username,
            email=user_in.email,
            hashed_password=hashed_password,
            last_name=user_in.last_name,
            first_name=user_in.first_name,
            middle_name=user_in.middle_name,
            birth_date=user_in.birth_date,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="User with this username or email already exists"
        )


async def update_user(
    db: AsyncSession, user_id: int, user_in: UserUpdate
) -> User | None:
    """Update user information asynchronously"""
    user = await get_user_by_id(db, user_id)
    if not user:
        return None

    # Update only provided fields
    update_data = user_in.dict(exclude_unset=True)

    if 'password' in update_data:
        update_data['hashed_password'] = User.get_password_hash(
            update_data.pop('password')
        )

    # Используем update для атомарной операции
    stmt = (
        update(User)
        .where(User.id == user_id)
        .values(**update_data)
        .execution_options(synchronize_session="fetch")
    )

    await db.execute(stmt)
    await db.commit()

    # Получаем обновленного пользователя
    return await get_user_by_id(db, user_id)


async def deactivate_user(db: AsyncSession, user_id: int) -> bool:
    """Deactivate user (soft delete) asynchronously"""
    stmt = (
        update(User)
        .where(User.id == user_id)
        .values(is_active=False)
        .execution_options(synchronize_session="fetch")
    )

    result = await db.execute(stmt)
    await db.commit()

    return result.rowcount > 0


async def activate_user(db: AsyncSession, user_id: int) -> bool:
    """Activate user asynchronously"""
    stmt = (
        update(User)
        .where(User.id == user_id)
        .values(is_active=True)
        .execution_options(synchronize_session="fetch")
    )

    result = await db.execute(stmt)
    await db.commit()

    return result.rowcount > 0


async def authenticate_user(
    db: AsyncSession, username: str, password: str
) -> User | None:
    """Authenticate user by username and password asynchronously"""
    user = await get_user_by_username(db, username)
    if not user or not user.is_active:
        return None
    if not user.verify_password(password):
        return None
    return user
