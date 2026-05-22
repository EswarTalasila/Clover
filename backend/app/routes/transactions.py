import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Transaction
from app.schemas import TransactionCreate, TransactionUpdate, TransactionOut
from app.lib.claude import categorize_transaction

router = APIRouter()


@router.get("/", response_model=list[TransactionOut])
async def list_transactions(
    month: str | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    query = select(Transaction).where(Transaction.user_id == user_id).order_by(Transaction.date.desc())
    if month:
        year, m = month.split("-")
        query = query.where(
            Transaction.date >= date(int(year), int(m), 1),
            Transaction.date < date(int(year), int(m) + 1 if int(m) < 12 else 1, 1)
            if int(m) < 12
            else date(int(year) + 1, 1, 1),
        )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
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
    await db.refresh(tx)
    return tx


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

    await db.commit()
    await db.refresh(tx)
    return tx


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

    await db.delete(tx)
    await db.commit()
