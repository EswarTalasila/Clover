import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Goal, GoalContribution, Transaction
from app.schemas import (
    GoalCreate,
    GoalUpdate,
    GoalOut,
    ContributionCreate,
    ContributionOut,
    GoalSuggestion,
)
from app.lib.claude import suggest_goal_contributions

router = APIRouter()

# Transactions that look like money set aside (used to scope AI contribution suggestions).
SAVINGS_KEYWORDS = [
    "savings", "transfer", "brokerage", "invest", "vanguard", "fidelity", "schwab",
    "betterment", "wealthfront", "ally", "robinhood", "401k", "roth", "ira",
    "deposit", "fund", "card payment", "credit card payment",
]


def _contribution_out(c: GoalContribution) -> ContributionOut:
    return ContributionOut(
        id=c.id,
        goal_id=c.goal_id,
        transaction_id=c.transaction_id,
        amount=c.amount,
        source=c.source,
        note=c.note,
        created_at=c.created_at,
        transaction_description=c.transaction.description if c.transaction else None,
        transaction_date=c.transaction.date if c.transaction else None,
    )


@router.get("", response_model=list[GoalOut])
async def list_goals(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(Goal.user_id == user_id).order_by(Goal.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    body: GoalCreate,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    if body.target_amount <= 0:
        raise HTTPException(status_code=400, detail="Target amount must be positive")
    if body.current_amount < 0:
        raise HTTPException(status_code=400, detail="Current amount cannot be negative")

    goal = Goal(
        user_id=user_id,
        name=body.name,
        target_amount=body.target_amount,
        current_amount=body.current_amount,
        target_date=body.target_date,
        note=body.note,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


@router.get("/suggestions", response_model=list[GoalSuggestion])
async def goal_suggestions(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    goals = (await db.execute(select(Goal).where(Goal.user_id == user_id))).scalars().all()
    if not goals:
        return []

    linked = (
        await db.execute(
            select(GoalContribution.transaction_id).where(
                GoalContribution.user_id == user_id,
                GoalContribution.transaction_id.isnot(None),
            )
        )
    ).scalars().all()
    linked_ids = set(linked)

    keyword_filters = [Transaction.description.icontains(k, autoescape=True) for k in SAVINGS_KEYWORDS]
    keyword_filters += [Transaction.merchant_name.icontains(k, autoescape=True) for k in SAVINGS_KEYWORDS]
    candidates = (
        await db.execute(
            select(Transaction)
            .where(Transaction.user_id == user_id, Transaction.amount > 0, or_(*keyword_filters))
            .order_by(Transaction.date.desc())
            .limit(25)
        )
    ).scalars().all()
    candidates = [t for t in candidates if t.id not in linked_ids]
    if not candidates:
        return []

    goal_payload = [{"id": str(g.id), "name": g.name, "note": g.note or ""} for g in goals]
    tx_payload = [
        {"id": str(t.id), "description": t.description, "merchant_name": t.merchant_name, "amount": float(t.amount)}
        for t in candidates
    ]
    matches = await suggest_goal_contributions(goal_payload, tx_payload)

    goals_by_id = {str(g.id): g for g in goals}
    tx_by_id = {str(t.id): t for t in candidates}
    suggestions = []
    seen_tx = set()
    for m in matches:
        tx = tx_by_id.get(m["transaction_id"])
        goal = goals_by_id.get(m["goal_id"])
        if not tx or not goal or m["transaction_id"] in seen_tx:
            continue
        seen_tx.add(m["transaction_id"])
        suggestions.append(
            GoalSuggestion(
                transaction_id=tx.id,
                description=tx.description,
                merchant_name=tx.merchant_name,
                amount=tx.amount,
                date=tx.date,
                goal_id=goal.id,
                goal_name=goal.name,
                reason=m["reason"],
            )
        )
    return suggestions


@router.get("/{goal_id}/contributions", response_model=list[ContributionOut])
async def list_contributions(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    goal = (
        await db.execute(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id))
    ).scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    rows = (
        await db.execute(
            select(GoalContribution)
            .options(selectinload(GoalContribution.transaction))
            .where(GoalContribution.goal_id == goal_id)
            .order_by(GoalContribution.created_at.desc())
        )
    ).scalars().all()
    return [_contribution_out(c) for c in rows]


@router.post("/{goal_id}/contributions", response_model=ContributionOut, status_code=status.HTTP_201_CREATED)
async def add_contribution(
    goal_id: uuid.UUID,
    body: ContributionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    goal = (
        await db.execute(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id))
    ).scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Contribution amount must be positive")

    source = "manual"
    if body.transaction_id is not None:
        tx = (
            await db.execute(
                select(Transaction).where(
                    Transaction.id == body.transaction_id, Transaction.user_id == user_id
                )
            )
        ).scalar_one_or_none()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        existing = (
            await db.execute(
                select(GoalContribution).where(GoalContribution.transaction_id == body.transaction_id)
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="That transaction is already linked to a goal")
        source = "ai"

    contribution = GoalContribution(
        user_id=user_id,
        goal_id=goal_id,
        transaction_id=body.transaction_id,
        amount=body.amount,
        source=source,
        note=body.note,
    )
    goal.current_amount = goal.current_amount + body.amount
    db.add(contribution)
    await db.commit()
    await db.refresh(contribution, attribute_names=["amount", "transaction"])
    return _contribution_out(contribution)


@router.delete("/contributions/{contribution_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contribution(
    contribution_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    contribution = (
        await db.execute(
            select(GoalContribution).where(
                GoalContribution.id == contribution_id, GoalContribution.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")

    goal = (await db.execute(select(Goal).where(Goal.id == contribution.goal_id))).scalar_one_or_none()
    if goal:
        goal.current_amount = max(Decimal("0"), goal.current_amount - contribution.amount)
    await db.delete(contribution)
    await db.commit()


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: uuid.UUID,
    body: GoalUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if body.name is not None:
        goal.name = body.name
    if body.target_amount is not None:
        if body.target_amount <= 0:
            raise HTTPException(status_code=400, detail="Target amount must be positive")
        goal.target_amount = body.target_amount
    if body.current_amount is not None:
        if body.current_amount < 0:
            raise HTTPException(status_code=400, detail="Current amount cannot be negative")
        goal.current_amount = body.current_amount
    if body.target_date is not None:
        goal.target_date = body.target_date
    if body.note is not None:
        goal.note = body.note

    await db.commit()
    await db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    await db.delete(goal)
    await db.commit()
