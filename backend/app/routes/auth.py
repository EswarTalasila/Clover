import os
import uuid
from datetime import datetime, timedelta
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from jose import jwt
from app.database import get_db
from app.lib.rate_limit import limiter
from app.middleware.auth import get_current_user
from app.models import User, Account, Transaction, Budget
from app.schemas import UserCreate, UserLogin, TokenOut, UserOut, PasswordChange

router = APIRouter()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))


def create_token(user_id: uuid.UUID) -> str:
    payload = {"sub": str(user_id), "exp": datetime.utcnow() + timedelta(days=30)}
    return jwt.encode(payload, os.getenv("JWT_SECRET"), algorithm="HS256")


@router.post("/register", response_model=TokenOut)
@limiter.limit("5/minute")
async def register(request: Request, response: Response, body: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=body.email, hashed_password=hash_password(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenOut(access_token=create_token(user.id))


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
async def login(request: Request, response: Response, body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenOut(access_token=create_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: PasswordChange,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 6 characters")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()


@router.get("/export")
async def export_data(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
    accounts = (await db.execute(select(Account).where(Account.user_id == user_id))).scalars().all()
    transactions = (await db.execute(select(Transaction).where(Transaction.user_id == user_id))).scalars().all()
    budgets = (await db.execute(select(Budget).where(Budget.user_id == user_id))).scalars().all()

    def serialize(obj):
        out = {}
        for col in obj.__table__.columns.keys():
            val = getattr(obj, col)
            if hasattr(val, "isoformat"):
                val = val.isoformat()
            elif val is not None and not isinstance(val, (str, int, float, bool, list, dict)):
                val = str(val)
            out[col] = val
        return out

    return {
        "user": {"id": str(user.id), "email": user.email, "created_at": user.created_at.isoformat()},
        "accounts": [serialize(a) for a in accounts],
        "transactions": [serialize(t) for t in transactions],
        "budgets": [serialize(b) for b in budgets],
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    await db.execute(delete(Transaction).where(Transaction.user_id == user_id))
    await db.execute(delete(Budget).where(Budget.user_id == user_id))
    await db.execute(delete(Account).where(Account.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
