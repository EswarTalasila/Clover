"""
Regression tests for specific bugs we've fixed.
Each test should fail if the underlying bug is reintroduced.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch


async def _user_headers(client, email):
    resp = await client.post(
        "/api/auth/register", json={"email": email, "password": "password123"}
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# --- Bug: December date filter crashed because of bad ternary nesting ----------------
async def test_regression_december_month_filter_does_not_crash(client):
    """Filtering transactions for December previously hit a Python ternary bug."""
    headers = await _user_headers(client, "dec@example.com")

    for d in ["2026-11-15", "2026-12-01", "2026-12-31", "2027-01-15"]:
        await client.post(
            "/api/transactions",
            headers=headers,
            json={"amount": "1", "description": "Test", "date": d},
        )

    resp = await client.get("/api/transactions?month=2026-12", headers=headers)
    assert resp.status_code == 200
    dates = [t["date"] for t in resp.json()]
    assert sorted(dates) == ["2026-12-01", "2026-12-31"]


async def test_regression_december_budget_summary_does_not_crash(client):
    """Budget summary builds month_end via the same date math; also test December."""
    headers = await _user_headers(client, "decbudget@example.com")
    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "50", "description": "Dec spending", "category": "Shopping", "date": "2026-12-15"},
    )

    resp = await client.get("/api/budgets/summary?month=2026-12", headers=headers)
    assert resp.status_code == 200
    assert any(item["category"] == "Shopping" for item in resp.json())


# --- Bug: slowapi limit decorator required `response: Response` parameter ------------
async def test_regression_register_route_returns_token_without_500(client):
    """Previously, slowapi raised on missing Response param, returning 500 after DB write."""
    resp = await client.post(
        "/api/auth/register",
        json={"email": "slowapi-fix@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_regression_login_route_returns_token_without_500(client):
    await client.post(
        "/api/auth/register",
        json={"email": "loginfix@example.com", "password": "password123"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "loginfix@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


# --- Bug: trailing-slash 307 redirects stripped CORS headers ---------------------------
async def test_regression_post_transactions_without_trailing_slash(client):
    """POST /api/transactions (no trailing slash) should respond directly, not 307."""
    headers = await _user_headers(client, "noslash@example.com")
    resp = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "5", "description": "Test", "date": "2026-05-01"},
    )
    assert resp.status_code == 201
    # Importantly, not 307
    assert resp.status_code != 307


async def test_regression_post_budgets_without_trailing_slash(client):
    headers = await _user_headers(client, "noslashbudget@example.com")
    resp = await client.post(
        "/api/budgets",
        headers=headers,
        json={"category": "Food & Dining", "monthly_limit": "100", "month": "2026-05"},
    )
    assert resp.status_code == 200
    assert resp.status_code != 307


# --- Bug: Plaid sync overwrote user-edited categories ---------------------------------
async def test_regression_user_category_preserved_on_modified_sync(client, db_session):
    """If the user manually changed a transaction's category, sync of a 'modified' update
    from Plaid must not clobber that user choice."""
    from app.models import Account, Transaction, User
    from sqlalchemy import select

    headers = await _user_headers(client, "preserve@example.com")
    user = (
        await db_session.execute(select(User).where(User.email == "preserve@example.com"))
    ).scalar_one()
    account = Account(
        user_id=user.id,
        plaid_access_token="access-fake",
        plaid_item_id="item-fake",
        institution_name="Test",
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    # Seed a transaction the user has explicitly categorized (not "Other")
    tx = Transaction(
        user_id=user.id,
        account_id=account.id,
        plaid_transaction_id="plaid-tx-123",
        amount=Decimal("50"),
        description="Mystery merchant",
        category="Travel",  # user override
        date=date(2026, 5, 1),
        is_manual=False,
    )
    db_session.add(tx)
    await db_session.commit()

    modified_payload = {
        "transaction_id": "plaid-tx-123",
        "amount": 50,
        "name": "Mystery merchant",
        "date": "2026-05-01",
        "pending": False,
        "personal_finance_category": {"primary": "GENERAL_MERCHANDISE", "detailed": "GENERAL_MERCHANDISE_OTHER"},
    }
    sync_response = {
        "added": [],
        "modified": [modified_payload],
        "removed": [],
        "next_cursor": "c2",
        "has_more": False,
    }

    with patch("app.lib.plaid.sync_transactions", AsyncMock(return_value=sync_response)):
        sync_resp = await client.post("/api/plaid/sync", headers=headers)
    assert sync_resp.status_code == 200

    # User's category survives
    tx_list = await client.get("/api/transactions", headers=headers)
    found = next(t for t in tx_list.json() if t["description"] == "Mystery merchant")
    assert found["category"] == "Travel", "Sync overwrote user-edited category"


# --- Bug: Plaid sync had N+1 query on duplicate detection ------------------------------
async def test_regression_sync_handles_many_added_transactions(client, db_session):
    """Synthetic test: sync with 25 added transactions should succeed and dedupe properly
    on subsequent runs (no N+1 crash, no duplicate inserts)."""
    from app.models import Account, User
    from sqlalchemy import select

    headers = await _user_headers(client, "many-txs@example.com")
    user = (
        await db_session.execute(select(User).where(User.email == "many-txs@example.com"))
    ).scalar_one()
    account = Account(
        user_id=user.id,
        plaid_access_token="access-fake",
        plaid_item_id="item-fake",
        institution_name="Test",
    )
    db_session.add(account)
    await db_session.commit()

    added = [
        {
            "transaction_id": f"tx-{i}",
            "amount": 10 + i,
            "name": f"Tx {i}",
            "date": "2026-05-15",
            "pending": False,
            "personal_finance_category": {"primary": "FOOD_AND_DRINK", "detailed": "FOOD_AND_DRINK_RESTAURANT"},
        }
        for i in range(25)
    ]

    payload = {"added": added, "modified": [], "removed": [], "next_cursor": "c1", "has_more": False}
    with patch("app.lib.plaid.sync_transactions", AsyncMock(return_value=payload)):
        first = await client.post("/api/plaid/sync", headers=headers)
    assert first.status_code == 200
    assert first.json()["added"] == 25

    # Re-sync: dedup should prevent duplicates
    with patch("app.lib.plaid.sync_transactions", AsyncMock(return_value=payload)):
        second = await client.post("/api/plaid/sync", headers=headers)
    assert second.status_code == 200
    assert second.json()["added"] == 0

    listing = await client.get("/api/transactions?month=2026-05", headers=headers)
    assert len(listing.json()) == 25


# --- Bug: deleting Plaid (non-manual) transactions should be blocked ------------------
async def test_regression_plaid_transaction_delete_returns_400(client, db_session):
    from app.models import Transaction, User
    from sqlalchemy import select

    headers = await _user_headers(client, "noblock@example.com")
    user = (
        await db_session.execute(select(User).where(User.email == "noblock@example.com"))
    ).scalar_one()

    tx = Transaction(
        user_id=user.id,
        amount=Decimal("10"),
        description="Synced",
        date=date(2026, 5, 1),
        is_manual=False,
    )
    db_session.add(tx)
    await db_session.commit()
    await db_session.refresh(tx)

    resp = await client.delete(f"/api/transactions/{tx.id}", headers=headers)
    assert resp.status_code == 400
    assert "cannot be deleted" in resp.json()["detail"].lower()


# --- Bug: budget_summary's month_end calculation broke at year boundary ---------------
async def test_regression_year_boundary_month_filter(client):
    headers = await _user_headers(client, "yearbound@example.com")

    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "10", "description": "Dec end", "category": "Shopping", "date": "2026-12-31"},
    )
    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "10", "description": "Jan start", "category": "Shopping", "date": "2027-01-01"},
    )

    dec = await client.get("/api/budgets/summary?month=2026-12", headers=headers)
    jan = await client.get("/api/budgets/summary?month=2027-01", headers=headers)

    assert Decimal(dec.json()[0]["spent"]) == Decimal("10")
    assert Decimal(jan.json()[0]["spent"]) == Decimal("10")
