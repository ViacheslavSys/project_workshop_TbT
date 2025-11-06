import re
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, constr, validator

# Валидация логина (только буквы, цифры, точки, тире, подчеркивания)
username_regex = r'^[a-zA-Z0-9._-]+$'


class UserBase(BaseModel):
    username: constr(min_length=3, max_length=50)
    email: EmailStr
    last_name: constr(min_length=1, max_length=50)
    first_name: constr(min_length=1, max_length=50)
    middle_name: Optional[constr(max_length=50)] = None
    birth_date: date

    @validator('username')
    def validate_username(cls, v):
        if not re.match(username_regex, v):
            raise ValueError(
                'Username can only contain letters, numbers, dots, dashes and underscores'
            )
        return v

    @validator('birth_date')
    def validate_birth_date(cls, v):
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age < 14:
            raise ValueError('User must be at least 14 years old')
        return v


class UserCreate(UserBase):
    password: constr(min_length=6)


class UserUpdate(BaseModel):
    last_name: Optional[constr(min_length=1, max_length=50)] = None
    first_name: Optional[constr(min_length=1, max_length=50)] = None
    middle_name: Optional[constr(max_length=50)] = None
    password: Optional[constr(min_length=6)] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    last_name: str
    first_name: str
    middle_name: Optional[str] = None
    birth_date: date
    is_active: bool
    created_at: datetime
    age: int  # Вычисляемое поле

    class Config:
        orm_mode = True


class UserLogin(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    authenticated: bool
    user_id: int | None = None
    message: str = ""
    access_token: Optional[str] = None
    token_type: Optional[str] = None


class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None
