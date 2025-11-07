from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.dependencies import get_current_user
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.user import AuthResponse, UserCreate, UserLogin, UserOut, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])
security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Публичные эндпоинты (не требуют аутентификации)
@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """Create new user (регистрация)"""
    return user_service.add_user(db, user_in)


@router.post("/login", response_model=AuthResponse)
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Аутентификация пользователя и выдача JWT токена
    """
    try:
        user = user_service.authenticate_user(
            db, login_data.username, login_data.password
        )

        # Создаем JWT токен
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "user_id": user.id},
            expires_delta=access_token_expires,
        )

        return AuthResponse(
            authenticated=True,
            user_id=user.id,
            access_token=access_token,
            token_type="bearer",
            message="Аутентификация успешна",
        )
    except HTTPException as e:
        if e.status_code == 401:
            return AuthResponse(
                authenticated=False, message="Неверный логин или пароль"
            )
        elif e.status_code == 400:
            return AuthResponse(
                authenticated=False, message="Пользователь деактивирован"
            )
        else:
            raise e


# 🔐 ЛИЧНЫЕ эндпоинты (работают с текущим пользователем)
@router.get("/me", response_model=UserOut)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info"""
    return current_user


@router.put("/me", response_model=UserOut)
def update_current_user(
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user information"""
    return user_service.edit_user(db, current_user.id, user_in)


@router.delete("/me")
def deactivate_current_user(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Deactivate current user (soft delete)"""
    return user_service.deactivate_user(db, current_user.id)


@router.patch("/me/activate")
def activate_current_user(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Activate current user"""
    return user_service.activate_user(db, current_user.id)


# 🔧 АДМИНСКИЕ эндпоинты (работают с любыми пользователями по ID)
@router.get("/", response_model=list[UserOut])
def get_users(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Number of records to return"),
    active_only: bool = Query(False, description="Show only active users"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of users (только для просмотра)"""
    if active_only:
        return user_service.list_active_users(db)
    return user_service.list_users(db, skip, limit)


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user by ID (только для просмотра)"""
    return user_service.get_user_by_id(db, user_id)
