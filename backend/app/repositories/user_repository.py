from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    """Get paginated list of users"""
    return db.query(User).offset(skip).limit(limit).all()


def get_active_users(db: Session) -> list[User]:
    """Get only active users"""
    return db.query(User).filter(User.is_active).all()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    """Get user by ID"""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    """Get user by username (for authentication)"""
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    """Get user by email (for uniqueness check)"""
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, user_in: UserCreate) -> User:
    """Create new user with uniqueness validation"""
    # Check username uniqueness
    existing_user = get_user_by_username(db, user_in.username)
    if existing_user:
        raise HTTPException(
            status_code=409, detail=f"Username '{user_in.username}' already exists"
        )

    # Check email uniqueness
    existing_email = get_user_by_email(db, user_in.email)
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
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="User with this username or email already exists"
        )


def update_user(db: Session, user_id: int, user_in: UserUpdate) -> User | None:
    """Update user information"""
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    # Update only provided fields
    update_data = user_in.dict(exclude_unset=True)

    if 'password' in update_data:
        update_data['hashed_password'] = User.get_password_hash(
            update_data.pop('password')
        )

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


def deactivate_user(db: Session, user_id: int) -> bool:
    """Deactivate user (soft delete)"""
    user = get_user_by_id(db, user_id)
    if not user:
        return False
    user.is_active = False
    db.commit()
    return True


def activate_user(db: Session, user_id: int) -> bool:
    """Activate user"""
    user = get_user_by_id(db, user_id)
    if not user:
        return False
    user.is_active = True
    db.commit()
    return True


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    """Authenticate user by username and password"""
    user = get_user_by_username(db, username)
    if not user or not user.is_active:
        return None
    if not user.verify_password(password):
        return None
    return user
