from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db  # ← Импортируйте асинхронный get_db
from app.core.security import verify_token
from app.repositories import user_repository

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPBearer = Depends(security),
    db: AsyncSession = Depends(get_db),  # ← Используйте AsyncSession
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials.scheme == "Bearer":
        raise credentials_exception

    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    username: str = payload.get("sub")
    user_id: int = payload.get("user_id")

    if username is None or user_id is None:
        raise credentials_exception

    # Используйте асинхронную версию репозитория
    user = await user_repository.get_user_by_id(db, user_id)  # ← Добавьте await
    if user is None or user.username != username or not user.is_active:
        raise credentials_exception

    return user


def get_session_token(request: dict):
    """Извлекает session_token из тела запроса (для обратной совместимости)"""
    return request.get("user_id")
