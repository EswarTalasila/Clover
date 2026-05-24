"""Boundary conditions and input validation."""

from decimal import Decimal


async def _user_headers(client, email):
    resp = await client.post(
        "/api/auth/register", json={"email": email, "password": "password123"}
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# --- Empty states --------------------------------------------------------------
async def test_summary_returns_empty_for_user_with_no_data(client):
    headers = await _user_headers(client, "empty@example.com")
    resp = await client.get("/api/budgets/summary?month=2026-05", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_trend_returns_zero_filled_array_for_empty_user(client):
    headers = await _user_headers(client, "empty-trend@example.com")
    resp = await client.get("/api/budgets/trend?months=6", headers=headers)
    body = resp.json()
    assert len(body) == 6
    assert all(Decimal(p["spent"]) == Decimal("0") for p in body)


async def test_top_merchants_returns_empty_with_no_transactions(client):
    headers = await _user_headers(client, "empty-merch@example.com")
    resp = await client.get("/api/transactions/top-merchants?month=2026-05", headers=headers)
    assert resp.json() == []


async def test_goals_listing_empty(client):
    headers = await _user_headers(client, "empty-goals@example.com")
    resp = await client.get("/api/goals", headers=headers)
    assert resp.json() == []


# --- Month boundaries ----------------------------------------------------------
async def test_transaction_on_first_of_month_included(client):
    headers = await _user_headers(client, "first@example.com")
    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "1", "description": "First", "date": "2026-05-01"},
    )
    resp = await client.get("/api/transactions?month=2026-05", headers=headers)
    assert len(resp.json()) == 1


async def test_transaction_on_last_of_month_included(client):
    headers = await _user_headers(client, "last@example.com")
    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "1", "description": "Last", "date": "2026-05-31"},
    )
    resp = await client.get("/api/transactions?month=2026-05", headers=headers)
    assert len(resp.json()) == 1


async def test_transaction_on_next_month_excluded(client):
    headers = await _user_headers(client, "next@example.com")
    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "1", "description": "Next", "date": "2026-06-01"},
    )
    resp = await client.get("/api/transactions?month=2026-05", headers=headers)
    assert resp.json() == []


# --- Decimal precision ---------------------------------------------------------
async def test_decimal_precision_preserved(client):
    headers = await _user_headers(client, "decimal@example.com")
    created = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "12.34", "description": "Precise", "date": "2026-05-01"},
    )
    assert Decimal(created.json()["amount"]) == Decimal("12.34")


async def test_large_amount_accepted(client):
    headers = await _user_headers(client, "biggie@example.com")
    resp = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "99999999.99", "description": "Mortgage", "date": "2026-05-01"},
    )
    # Numeric(10, 2) accepts up to 99,999,999.99
    assert resp.status_code == 201


# --- Validation rejection ------------------------------------------------------
async def test_register_rejects_invalid_email(client):
    resp = await client.post(
        "/api/auth/register", json={"email": "not-an-email", "password": "password123"}
    )
    assert resp.status_code == 422


async def test_password_change_rejects_short_new_password(client):
    headers = await _user_headers(client, "shortpwd@example.com")
    resp = await client.patch(
        "/api/auth/password",
        headers=headers,
        json={"current_password": "password123", "new_password": "abc"},
    )
    assert resp.status_code == 400


async def test_password_change_rejects_wrong_current_password(client):
    headers = await _user_headers(client, "wrongcurr@example.com")
    resp = await client.patch(
        "/api/auth/password",
        headers=headers,
        json={"current_password": "wrong-pwd", "new_password": "newpassword123"},
    )
    assert resp.status_code == 401


async def test_goal_target_amount_must_be_positive(client):
    headers = await _user_headers(client, "goalbad@example.com")
    resp = await client.post(
        "/api/goals", headers=headers, json={"name": "Bad", "target_amount": "-50"}
    )
    assert resp.status_code == 400


async def test_top_merchants_limit_validation(client):
    headers = await _user_headers(client, "limitcheck@example.com")
    resp = await client.get("/api/transactions/top-merchants?limit=0", headers=headers)
    assert resp.status_code == 400

    resp = await client.get("/api/transactions/top-merchants?limit=100", headers=headers)
    assert resp.status_code == 400


# --- Long strings --------------------------------------------------------------
async def test_long_description_accepted(client):
    headers = await _user_headers(client, "longdesc@example.com")
    long_desc = "x" * 2000
    resp = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "1", "description": long_desc, "date": "2026-05-01"},
    )
    assert resp.status_code == 201
    assert resp.json()["description"] == long_desc


async def test_long_goal_note(client):
    headers = await _user_headers(client, "longnote@example.com")
    long_note = "details " * 200
    resp = await client.post(
        "/api/goals",
        headers=headers,
        json={"name": "G", "target_amount": "100", "note": long_note},
    )
    assert resp.status_code == 201


# --- Income exclusion in aggregates --------------------------------------------
async def test_income_excluded_from_budget_summary_totals(client):
    headers = await _user_headers(client, "income@example.com")

    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "5000", "description": "Paycheck", "category": "Income", "date": "2026-05-01"},
    )
    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "20", "description": "Coffee", "category": "Food & Dining", "date": "2026-05-01"},
    )

    summary = await client.get("/api/budgets/summary?month=2026-05", headers=headers)
    categories = {item["category"]: item for item in summary.json()}
    assert "Income" not in categories
    assert Decimal(categories["Food & Dining"]["spent"]) == Decimal("20")


async def test_income_excluded_from_trend(client):
    headers = await _user_headers(client, "incomeT@example.com")
    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "5000", "description": "Pay", "category": "Income", "date": "2026-05-01"},
    )
    trend = await client.get("/api/budgets/trend?months=6", headers=headers)
    may = next(p for p in trend.json() if p["month"] == "2026-05")
    assert Decimal(may["spent"]) == Decimal("0")


async def test_negative_amount_treated_as_inflow_excluded_from_spending(client):
    """Plaid uses negative amounts for refunds/credits — should not count as spending."""
    headers = await _user_headers(client, "refund@example.com")
    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "-50", "description": "Refund", "category": "Shopping", "date": "2026-05-01"},
    )

    summary = await client.get("/api/budgets/summary?month=2026-05", headers=headers)
    # The refund row appears as 0 spent (it's a negative inflow, the filter drops it)
    if summary.json():
        assert all(Decimal(item["spent"]) <= 0 or item["category"] != "Shopping" for item in summary.json())


# --- Date format edge cases ----------------------------------------------------
async def test_leap_day_transaction_accepted(client):
    headers = await _user_headers(client, "leap@example.com")
    resp = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "1", "description": "Feb 29", "date": "2028-02-29"},
    )
    assert resp.status_code == 201

    listing = await client.get("/api/transactions?month=2028-02", headers=headers)
    assert len(listing.json()) == 1


# --- Pagination / limit sanity -------------------------------------------------
async def test_top_merchants_respects_limit(client, db_session):
    from app.models import Transaction, User
    from sqlalchemy import select
    from datetime import date as date_cls

    headers = await _user_headers(client, "manymerch@example.com")
    user = (
        await db_session.execute(select(User).where(User.email == "manymerch@example.com"))
    ).scalar_one()

    for i in range(10):
        tx = Transaction(
            user_id=user.id,
            amount=Decimal(str(i + 1)),
            description=f"Tx {i}",
            merchant_name=f"Merchant-{i}",
            category="Shopping",
            date=date_cls(2026, 5, 1),
            is_manual=True,
        )
        db_session.add(tx)
    await db_session.commit()

    resp = await client.get("/api/transactions/top-merchants?limit=3", headers=headers)
    assert len(resp.json()) == 3
    resp = await client.get("/api/transactions/top-merchants?limit=10", headers=headers)
    assert len(resp.json()) == 10
