import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Transaction
from app.schemas import TransactionCreate, TransactionUpdate, TransactionOut, TopMerchant, AiSearchResponse
from app.lib.claude import categorize_transaction, parse_search_query, CATEGORIES


def to_out(tx: Transaction) -> TransactionOut:
    institution = tx.account.institution_name if tx.account else None
    return TransactionOut(
        id=tx.id,
        amount=tx.amount,
        description=tx.description,
        merchant_name=tx.merchant_name,
        merchant_website=tx.merchant_website,
        merchant_logo_url=tx.merchant_logo_url,
        iso_currency_code=tx.iso_currency_code,
        authorized_date=tx.authorized_date,
        category=tx.category,
        category_detailed=tx.category_detailed,
        payment_channel=tx.payment_channel,
        pending=tx.pending,
        location_city=tx.location_city,
        location_region=tx.location_region,
        notes=tx.notes,
        date=tx.date,
        is_manual=tx.is_manual,
        excluded=tx.excluded,
        account_institution=institution,
    )

router = APIRouter()


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    month: str | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    query = (
        select(Transaction)
        .options(selectinload(Transaction.account))
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc())
    )
    if month:
        year, m = (int(p) for p in month.split("-"))
        month_start = date(year, m, 1)
        month_end = date(year + 1, 1, 1) if m == 12 else date(year, m + 1, 1)
        query = query.where(
            Transaction.date >= month_start,
            Transaction.date < month_end,
        )
    result = await db.execute(query)
    return [to_out(tx) for tx in result.scalars().all()]


@router.get("/search", response_model=list[TransactionOut])
async def search_transactions(
    q: str,
    limit: int = 8,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    term = q.strip()
    if not term:
        return []
    limit = max(1, min(limit, 20))

    query = (
        select(Transaction)
        .options(selectinload(Transaction.account))
        .where(
            Transaction.user_id == user_id,
            or_(
                Transaction.description.icontains(term, autoescape=True),
                Transaction.merchant_name.icontains(term, autoescape=True),
                Transaction.category.icontains(term, autoescape=True),
                Transaction.notes.icontains(term, autoescape=True),
            ),
        )
        .order_by(Transaction.date.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    return [to_out(tx) for tx in result.scalars().all()]


class AiSearchRequest(BaseModel):
    q: str


def _to_decimal(value):
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _to_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None


@router.post("/search/ai", response_model=AiSearchResponse)
async def ai_search(
    body: AiSearchRequest,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    q = body.q.strip()
    if not q:
        return AiSearchResponse(interpretation="", results=[])

    filters = await parse_search_query(q)

    query = (
        select(Transaction)
        .options(selectinload(Transaction.account))
        .where(Transaction.user_id == user_id)
    )

    text = filters.get("text")
    if text:
        query = query.where(
            or_(
                Transaction.description.icontains(str(text), autoescape=True),
                Transaction.merchant_name.icontains(str(text), autoescape=True),
            )
        )
    category = filters.get("category")
    if category in CATEGORIES:
        query = query.where(Transaction.category == category)

    min_amount = _to_decimal(filters.get("min_amount"))
    if min_amount is not None:
        query = query.where(Transaction.amount >= min_amount)
    max_amount = _to_decimal(filters.get("max_amount"))
    if max_amount is not None:
        query = query.where(Transaction.amount <= max_amount)

    start_date = _to_date(filters.get("start_date"))
    if start_date:
        query = query.where(Transaction.date >= start_date)
    end_date = _to_date(filters.get("end_date"))
    if end_date:
        query = query.where(Transaction.date <= end_date)

    query = query.order_by(Transaction.date.desc()).limit(50)
    result = await db.execute(query)
    rows = [to_out(tx) for tx in result.scalars().all()]

    interpretation = str(filters.get("interpretation") or f'Results for "{q}"')
    return AiSearchResponse(interpretation=interpretation, results=rows)


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    category = body.category
    if not category:
        category = await categorize_transaction(body.description, float(body.amount))

    tx = Transaction(
        user_id=user_id,
        amount=body.amount,
        description=body.description,
        category=category,
        date=body.date,
        is_manual=True,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx, attribute_names=["account"])
    return to_out(tx)


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: uuid.UUID,
    body: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    if body.category is not None:
        tx.category = body.category
    if body.description is not None:
        tx.description = body.description
    if body.notes is not None:
        tx.notes = body.notes
    if body.excluded is not None:
        tx.excluded = body.excluded

    await db.commit()
    await db.refresh(tx, attribute_names=["account"])
    return to_out(tx)


@router.get("/top-merchants", response_model=list[TopMerchant])
async def top_merchants(
    month: str | None = None,
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    if limit < 1 or limit > 50:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 50")

    merchant_expr = func.coalesce(Transaction.merchant_name, Transaction.description).label("merchant")

    query = (
        select(
            merchant_expr,
            func.sum(Transaction.amount).label("spent"),
            func.count(Transaction.id).label("transaction_count"),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.amount > 0,
            Transaction.excluded.is_(False),
            Transaction.category != "Income",
        )
        .group_by("merchant")
        .order_by(func.sum(Transaction.amount).desc())
        .limit(limit)
    )

    if month:
        year, m = (int(p) for p in month.split("-"))
        month_start = date(year, m, 1)
        month_end = date(year + 1, 1, 1) if m == 12 else date(year, m + 1, 1)
        query = query.where(Transaction.date >= month_start, Transaction.date < month_end)

    result = await db.execute(query)
    return [
        TopMerchant(merchant=row[0] or "Unknown", spent=row[1], transaction_count=row[2])
        for row in result.all()
    ]


@router.post("/recategorize")
async def recategorize_uncategorized(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.category == "Other",
        )
    )
    txs = result.scalars().all()

    updated = 0
    for tx in txs:
        try:
            new_category = await categorize_transaction(tx.description, float(tx.amount))
        except Exception:
            continue
        if new_category and new_category != "Other":
            tx.category = new_category
            updated += 1

    await db.commit()
    return {"updated": updated, "total": len(txs)}


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    if not tx.is_manual:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bank-synced transactions cannot be deleted. Exclude it from your budget instead.",
        )

    await db.delete(tx)
    await db.commit()
