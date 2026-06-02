import hashlib
import os
import random
import secrets
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from jose import jwt
from app.database import get_db
from app.lib.rate_limit import limiter
from app.lib.mailer import send_email
from app.middleware.auth import get_current_user
from app.models import User, Account, Transaction, Budget, Goal, GoalContribution, PasswordResetToken
from app.schemas import (
    UserCreate,
    UserLogin,
    TokenOut,
    UserOut,
    PasswordChange,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)

RESET_TOKEN_TTL = timedelta(minutes=30)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

router = APIRouter()

# Columns that must never appear in a user-facing data export.
SENSITIVE_EXPORT_COLUMNS = {"plaid_access_token"}


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


# Merchant pools for generating believable demo activity: (name, low, high).
_DEMO_GROCERIES = [
    ("Whole Foods Market", 42, 130),
    ("Trader Joe's", 28, 95),
    ("Safeway", 22, 80),
]
_DEMO_DINING = [
    ("Starbucks", 4.25, 8.50),
    ("Blue Bottle Coffee", 5, 7.50),
    ("Chipotle", 10.95, 16.50),
    ("Sweetgreen", 12, 17),
    ("Shake Shack", 13, 24),
    ("Philz Coffee", 4.50, 9),
    ("Ramen Nagi", 16, 29),
    ("Tartine Bakery", 6, 19),
]
_DEMO_TRANSPORT = [
    ("Uber", 8, 32),
    ("Lyft", 7.50, 28),
    ("Shell", 34, 66),
    ("Chevron", 32, 60),
    ("Clipper Transit", 2.75, 12),
]
_DEMO_SHOPPING = [
    ("Amazon", 12, 140),
    ("Target", 18, 110),
    ("Apple Store", 29, 240),
    ("Uniqlo", 20, 95),
    ("Best Buy", 25, 180),
    ("IKEA", 24, 160),
]
_DEMO_ENTERTAINMENT = [
    ("AMC Theatres", 14, 38),
    ("Steam", 10, 60),
    ("Ticketmaster", 45, 160),
]
_DEMO_HEALTH = [
    ("CVS Pharmacy", 8, 45),
    ("Walgreens", 7, 38),
]
_DEMO_TRAVEL = [
    ("Delta Air Lines", 180, 520),
    ("Airbnb", 120, 480),
    ("Marriott", 140, 360),
]


def _money(value) -> Decimal:
    return Decimal(str(round(float(value), 2)))


def _rand_amount(low, high) -> Decimal:
    return _money(random.uniform(low, high))


def _build_demo_transactions(user_id: uuid.UUID) -> list[Transaction]:
    today = date.today()
    txns: list[Transaction] = []

    def month_year(offset: int) -> tuple[int, int]:
        m, y = today.month - offset, today.year
        while m <= 0:
            m += 12
            y -= 1
        return y, m

    for offset in range(6):  # current month + 5 prior months
        y, m = month_year(offset)
        max_day = today.day if offset == 0 else 28

        def tx(day, amount, description, merchant, category, excluded=False):
            txns.append(
                Transaction(
                    user_id=user_id,
                    amount=amount if isinstance(amount, Decimal) else _money(amount),
                    description=description,
                    merchant_name=merchant,
                    category=category,
                    iso_currency_code="USD",
                    date=date(y, m, max(1, min(day, max_day))),
                    is_manual=True,
                    excluded=excluded,
                )
            )

        # Income — two paychecks a month
        tx(1, Decimal("-2450.00"), "Acme Corp Payroll", "Acme Corp", "Income")
        tx(15, Decimal("-2450.00"), "Acme Corp Payroll", "Acme Corp", "Income")

        # Recurring bills and subscriptions
        tx(1, Decimal("1850.00"), "Rent", "Sunset Apartments", "Bills & Utilities")
        tx(3, Decimal("2.99"), "iCloud+", "Apple", "Bills & Utilities")
        tx(5, Decimal("34.99"), "24 Hour Fitness", "24 Hour Fitness", "Health")
        tx(6, _rand_amount(55, 115), "PG&E Electric", "PG&E", "Bills & Utilities")
        tx(8, Decimal("79.99"), "Comcast Xfinity", "Comcast", "Bills & Utilities")
        tx(12, Decimal("45.00"), "AT&T Wireless", "AT&T", "Bills & Utilities")
        tx(17, Decimal("15.49"), "Netflix", "Netflix", "Entertainment")
        tx(22, Decimal("11.99"), "Spotify Premium", "Spotify", "Entertainment")

        # Discretionary spending
        plan = [
            (_DEMO_GROCERIES, "Food & Dining", random.randint(3, 5)),
            (_DEMO_DINING, "Food & Dining", random.randint(6, 10)),
            (_DEMO_TRANSPORT, "Transportation", random.randint(3, 6)),
            (_DEMO_SHOPPING, "Shopping", random.randint(2, 4)),
            (_DEMO_ENTERTAINMENT, "Entertainment", random.randint(1, 2)),
            (_DEMO_HEALTH, "Health", random.randint(0, 2)),
        ]
        for pool, category, count in plan:
            for _ in range(count):
                name, low, high = random.choice(pool)
                tx(random.randint(1, 28), _rand_amount(low, high), name, name, category)

        # A trip a few months back, for some variety in the trend
        if offset == 3:
            for name, low, high in _DEMO_TRAVEL:
                tx(random.randint(10, 20), _rand_amount(low, high), name, name, "Travel")

        # Money set aside — excluded from spending, used as AI goal-contribution candidates
        if offset < 3:
            tx(2, Decimal("400.00"), "Transfer to Ally Savings", "Ally Bank", "Other", excluded=True)
            tx(3, Decimal("250.00"), "Vanguard Brokerage Deposit", "Vanguard", "Other", excluded=True)
            tx(18, Decimal("150.00"), "Japan Trip Fund Transfer", "Ally Bank", "Other", excluded=True)
            tx(20, Decimal("300.00"), "Chase Credit Card Payment", "Chase", "Other", excluded=True)

    return txns


def _build_demo_budgets(user_id: uuid.UUID) -> list[Budget]:
    month = date.today().strftime("%Y-%m")
    limits = {
        "Bills & Utilities": "2200",
        "Food & Dining": "650",
        "Transportation": "260",
        "Shopping": "400",
        "Entertainment": "120",
        "Health": "150",
    }
    return [
        Budget(user_id=user_id, category=c, monthly_limit=Decimal(v), month=month)
        for c, v in limits.items()
    ]


def _build_demo_goals(user_id: uuid.UUID) -> list[Goal]:
    today = date.today()

    def in_months(n: int) -> date:
        m, y = today.month + n, today.year
        while m > 12:
            m -= 12
            y += 1
        return date(y, m, min(today.day, 28))

    return [
        Goal(user_id=user_id, name="Emergency Fund", target_amount=Decimal("12000"),
             current_amount=Decimal("7400"), note="Three months of expenses"),
        Goal(user_id=user_id, name="Trip to Japan", target_amount=Decimal("5000"),
             current_amount=Decimal("1850"), target_date=in_months(6), note="Cherry blossom season"),
        Goal(user_id=user_id, name="New MacBook Pro", target_amount=Decimal("2400"),
             current_amount=Decimal("900"), target_date=in_months(3)),
        Goal(user_id=user_id, name="Pay off credit card", target_amount=Decimal("3000"),
             current_amount=Decimal("3000"), note="Reached!"),
    ]


@router.post("/demo", response_model=TokenOut)
@limiter.limit("5/minute")
async def demo(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    user = User(
        id=uuid.uuid4(),
        email=f"demo-{secrets.token_hex(6)}@demo.clover.app",
        hashed_password=hash_password(secrets.token_urlsafe(24)),
    )
    db.add(user)
    db.add_all(_build_demo_transactions(user.id))
    db.add_all(_build_demo_budgets(user.id))
    db.add_all(_build_demo_goals(user.id))
    await db.commit()
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
    if len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")
    if len(body.new_password) > 128:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password is too long")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()


@router.post("/forgot-password")
@limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    response: Response,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    # Always return the same response so the endpoint can't be used to discover
    # which emails have accounts.
    generic = {"message": "If an account exists for that email, a reset link has been sent."}

    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not user:
        return generic

    # Only one active reset link at a time.
    await db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)
        )
    )

    raw_token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(raw_token),
            expires_at=datetime.utcnow() + RESET_TOKEN_TTL,
        )
    )
    await db.commit()

    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    link = f"{frontend}/reset-password?token={raw_token}"
    await send_email(
        to=user.email,
        subject="Reset your Clover password",
        body=(
            "We received a request to reset your Clover password.\n\n"
            f"Reset it here (this link expires in 30 minutes):\n{link}\n\n"
            "If you didn't request this, you can safely ignore this email."
        ),
    )
    return generic


@router.post("/reset-password")
@limiter.limit("10/hour")
async def reset_password(
    request: Request,
    response: Response,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This reset link is invalid or has expired.",
    )

    reset = (
        await db.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == _hash_token(body.token))
        )
    ).scalar_one_or_none()
    if not reset or reset.used_at is not None or reset.expires_at < datetime.utcnow():
        raise invalid

    user = (await db.execute(select(User).where(User.id == reset.user_id))).scalar_one_or_none()
    if not user:
        raise invalid

    user.hashed_password = hash_password(body.new_password)
    reset.used_at = datetime.utcnow()
    await db.commit()
    return {"message": "Your password has been reset. You can now sign in."}


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
            if col in SENSITIVE_EXPORT_COLUMNS:
                continue
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
    await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
    await db.execute(delete(GoalContribution).where(GoalContribution.user_id == user_id))
    await db.execute(delete(Transaction).where(Transaction.user_id == user_id))
    await db.execute(delete(Budget).where(Budget.user_id == user_id))
    await db.execute(delete(Goal).where(Goal.user_id == user_id))
    await db.execute(delete(Account).where(Account.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
