import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, String
from sqlalchemy.dialects.postgresql import insert
from pydantic import BaseModel
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Budget, Transaction
from app.schemas import BudgetCreate, BudgetOut, BudgetSummaryItem

router = APIRouter()


@router.get("/", response_model=list[BudgetOut])
async def list_budgets(
    month: str,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    result = await db.execute(
        select(Budget).where(Budget.user_id == user_id, Budget.month == month)
    )
    return result.scalars().all()


@router.post("/", response_model=BudgetOut)
async def upsert_budget(
    body: BudgetCreate,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    stmt = (
        insert(Budget)
        .values(user_id=user_id, category=body.category, monthly_limit=body.monthly_limit, month=body.month)
        .on_conflict_do_update(
            index_elements=["user_id", "category", "month"],
            set_={"monthly_limit": body.monthly_limit},
        )
        .returning(Budget)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one()


@router.get("/summary", response_model=list[BudgetSummaryItem])
async def budget_summary(
    month: str,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    year, m = month.split("-")
    month_start = date(int(year), int(m), 1)
    month_end = date(int(year) + 1, 1, 1) if int(m) == 12 else date(int(year), int(m) + 1, 1)

    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == user_id, Budget.month == month)
    )
    budgets_by_category = {b.category: b for b in budgets_result.scalars().all()}

    spent_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= month_start,
            Transaction.date < month_end,
            Transaction.amount > 0,
            Transaction.category.isnot(None),
        )
        .group_by(Transaction.category)
    )
    spent_by_category = {row[0]: row[1] for row in spent_result.all()}

    categories = set(budgets_by_category.keys()) | set(spent_by_category.keys())
    categories.discard("Income")

    items = []
    for category in categories:
        budget = budgets_by_category.get(category)
        spent = spent_by_category.get(category, Decimal("0"))
        limit = budget.monthly_limit if budget else None
        remaining = (limit - spent) if limit is not None else None
        items.append(
            BudgetSummaryItem(
                category=category,
                monthly_limit=limit,
                spent=spent,
                remaining=remaining,
            )
        )

    items.sort(key=lambda x: (x.monthly_limit is None, -float(x.spent)))
    return items


class TrendPoint(BaseModel):
    month: str
    spent: Decimal


@router.get("/trend", response_model=list[TrendPoint])
async def spending_trend(
    months: int = 6,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    today = date.today()
    year = today.year
    month = today.month - (months - 1)
    while month <= 0:
        month += 12
        year -= 1
    start = date(year, month, 1)

    result = await db.execute(
        select(
            func.to_char(Transaction.date, "YYYY-MM").label("month"),
            func.sum(Transaction.amount).label("spent"),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.amount > 0,
            Transaction.category != "Income",
        )
        .group_by("month")
        .order_by("month")
    )
    by_month = {row[0]: row[1] for row in result.all()}

    points = []
    y, m = start.year, start.month
    for _ in range(months):
        key = f"{y:04d}-{m:02d}"
        points.append(TrendPoint(month=key, spent=by_month.get(key, Decimal("0"))))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return points
