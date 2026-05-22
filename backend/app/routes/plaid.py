import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Account, Transaction
from app.schemas import PlaidLinkTokenResponse, PlaidExchangeRequest
from app.lib import plaid as plaid_lib
from app.lib.claude import categorize_transaction

router = APIRouter()


@router.post("/link-token", response_model=PlaidLinkTokenResponse)
async def create_link_token(user_id: uuid.UUID = Depends(get_current_user)):
    token = await plaid_lib.create_link_token(str(user_id))
    return PlaidLinkTokenResponse(link_token=token)


@router.post("/exchange-token", status_code=status.HTTP_201_CREATED)
async def exchange_token(
    body: PlaidExchangeRequest,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    access_token, item_id = await plaid_lib.exchange_public_token(body.public_token)
    account = Account(
        user_id=user_id,
        plaid_access_token=access_token,
        plaid_item_id=item_id,
        institution_name=body.institution_name,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return {"account_id": str(account.id)}


@router.post("/sync")
async def sync_transactions(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    result = await db.execute(select(Account).where(Account.user_id == user_id))
    accounts = result.scalars().all()
    if not accounts:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No linked accounts")

    total_added = 0
    for account in accounts:
        data = await plaid_lib.sync_transactions(account.plaid_access_token)
        for t in data["added"]:
            category = await categorize_transaction(t.get("name", ""), t.get("amount", 0))
            tx = Transaction(
                user_id=user_id,
                account_id=account.id,
                amount=t["amount"],
                description=t.get("name", ""),
                category=category,
                date=date.fromisoformat(t["date"]),
                is_manual=False,
            )
            db.add(tx)
            total_added += 1

    await db.commit()
    return {"synced": total_added}
