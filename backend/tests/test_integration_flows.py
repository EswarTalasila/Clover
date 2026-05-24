"""End-to-end integration tests exercising multiple endpoints together."""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch


async def register_and_login(client, email="flow@example.com", password="password123"):
    resp = await client.post("/api/auth/register", json={"email": email, "password": password})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_full_signup_to_dashboard_flow(client):
    """A brand-new user signs up, adds a manual transaction, sets a budget, and sees correct summary."""
    headers = await register_and_login(client, "newuser@example.com")

    # 1. Identity check
    me = await client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "newuser@example.com"

    # 2. Empty dashboard
    summary = await client.get("/api/budgets/summary?month=2026-05", headers=headers)
    assert summary.status_code == 200
    assert summary.json() == []

    # 3. Add a transaction
    tx_resp = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "42.99", "description": "Groceries", "category": "Food & Dining", "date": "2026-05-15"},
    )
    assert tx_resp.status_code == 201

    # 4. Set a budget
    budget_resp = await client.post(
        "/api/budgets",
        headers=headers,
        json={"category": "Food & Dining", "monthly_limit": "500", "month": "2026-05"},
    )
    assert budget_resp.status_code == 200

    # 5. Summary now reflects both budget and spending
    summary = await client.get("/api/budgets/summary?month=2026-05", headers=headers)
    body = summary.json()
    assert len(body) == 1
    food = body[0]
    assert food["category"] == "Food & Dining"
    assert Decimal(food["spent"]) == Decimal("42.99")
    assert Decimal(food["monthly_limit"]) == Decimal("500")
    assert Decimal(food["remaining"]) == Decimal("457.01")


async def test_excluded_transaction_disappears_from_aggregates(client):
    headers = await register_and_login(client, "exclude@example.com")

    created = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "100", "description": "Refund-y thing", "category": "Shopping", "date": "2026-05-10"},
    )
    tx_id = created.json()["id"]

    before = await client.get("/api/budgets/summary?month=2026-05", headers=headers)
    assert Decimal(before.json()[0]["spent"]) == Decimal("100")

    top_before = await client.get("/api/transactions/top-merchants?month=2026-05", headers=headers)
    assert len(top_before.json()) == 1

    # Exclude
    await client.patch(f"/api/transactions/{tx_id}", headers=headers, json={"excluded": True})

    after = await client.get("/api/budgets/summary?month=2026-05", headers=headers)
    assert after.json() == []

    top_after = await client.get("/api/transactions/top-merchants?month=2026-05", headers=headers)
    assert top_after.json() == []

    # And the trend should not include it
    trend = await client.get("/api/budgets/trend?months=6", headers=headers)
    totals = {pt["month"]: Decimal(pt["spent"]) for pt in trend.json()}
    assert totals.get("2026-05", Decimal("0")) == Decimal("0")


async def test_goals_lifecycle(client):
    """Goal: create, update progress until complete, then delete."""
    headers = await register_and_login(client, "goals@example.com")

    created = await client.post(
        "/api/goals",
        headers=headers,
        json={"name": "Trip", "target_amount": "1000", "current_amount": "0"},
    )
    goal_id = created.json()["id"]

    # Update progress in steps
    for amount in ["250", "500", "750", "1000"]:
        resp = await client.patch(
            f"/api/goals/{goal_id}", headers=headers, json={"current_amount": amount}
        )
        assert resp.status_code == 200
        assert Decimal(resp.json()["current_amount"]) == Decimal(amount)

    # Delete
    delete_resp = await client.delete(f"/api/goals/{goal_id}", headers=headers)
    assert delete_resp.status_code == 204

    # Confirm gone
    listing = await client.get("/api/goals", headers=headers)
    assert listing.json() == []


async def test_budget_upsert_idempotency(client):
    """Setting the same category/month budget twice updates the same row."""
    headers = await register_and_login(client, "upsert@example.com")

    payload = {"category": "Food & Dining", "monthly_limit": "300", "month": "2026-05"}
    first = (await client.post("/api/budgets", headers=headers, json=payload)).json()

    payload["monthly_limit"] = "450"
    second = (await client.post("/api/budgets", headers=headers, json=payload)).json()

    assert first["id"] == second["id"]
    assert Decimal(second["monthly_limit"]) == Decimal("450")

    # And there's still only one budget for this category+month
    listing = await client.get("/api/budgets?month=2026-05", headers=headers)
    assert len(listing.json()) == 1


async def test_plaid_link_then_exchange_then_sync_then_balances(client, db_session):
    """Full Plaid flow with mocked SDK at each step."""
    headers = await register_and_login(client, "plaid-flow@example.com")

    # 1. Get link token
    lt = await client.post("/api/plaid/link-token", headers=headers)
    assert lt.status_code == 200
    assert lt.json()["link_token"] == "link-sandbox-fake"

    # 2. Exchange — creates an Account row
    ex = await client.post(
        "/api/plaid/exchange-token",
        headers=headers,
        json={"public_token": "public-test", "institution_name": "Test Bank"},
    )
    assert ex.status_code == 201

    accounts = await client.get("/api/plaid/accounts", headers=headers)
    assert len(accounts.json()) == 1
    assert accounts.json()[0]["institution_name"] == "Test Bank"

    # 3. Sync — mocked to return one new transaction
    plaid_tx = {
        "transaction_id": "plaid-tx-1",
        "amount": 25.50,
        "name": "Test Coffee Shop",
        "merchant_name": "Test Coffee",
        "date": "2026-05-15",
        "payment_channel": "in store",
        "pending": False,
        "personal_finance_category": {"primary": "FOOD_AND_DRINK", "detailed": "FOOD_AND_DRINK_COFFEE"},
        "location": {"city": "Seattle", "region": "WA"},
    }
    sync_response = {
        "added": [plaid_tx],
        "modified": [],
        "removed": [],
        "next_cursor": "cursor-after-sync",
        "has_more": False,
    }
    with patch("app.lib.plaid.sync_transactions", AsyncMock(return_value=sync_response)):
        sync_resp = await client.post("/api/plaid/sync", headers=headers)
    assert sync_resp.status_code == 200
    body = sync_resp.json()
    assert body["added"] == 1

    # 4. Transaction should now appear
    tx_list = await client.get("/api/transactions?month=2026-05", headers=headers)
    descriptions = [t["description"] for t in tx_list.json()]
    assert "Test Coffee Shop" in descriptions
    found = next(t for t in tx_list.json() if t["description"] == "Test Coffee Shop")
    assert found["category"] == "Food & Dining"  # mapped from FOOD_AND_DRINK
    assert found["location_city"] == "Seattle"
    assert found["is_manual"] is False

    # 5. Balances
    sample_balances = [
        {"name": "Checking", "type": "depository", "subtype": "checking", "mask": "0001",
         "balances": {"current": 2500, "available": 2400, "iso_currency_code": "USD"}},
    ]
    with patch("app.lib.plaid.get_accounts", AsyncMock(return_value=sample_balances)):
        bal = await client.get("/api/plaid/balances", headers=headers)
    assert bal.status_code == 200
    assert Decimal(bal.json()["assets"]) == Decimal("2500")
    assert Decimal(bal.json()["net_worth"]) == Decimal("2500")


async def test_password_change_then_login_with_new_password(client):
    headers = await register_and_login(client, "pwdchange@example.com", "oldpassword123")

    # Change password
    resp = await client.patch(
        "/api/auth/password",
        headers=headers,
        json={"current_password": "oldpassword123", "new_password": "newpassword456"},
    )
    assert resp.status_code == 204

    # Old password fails
    old = await client.post(
        "/api/auth/login",
        json={"email": "pwdchange@example.com", "password": "oldpassword123"},
    )
    assert old.status_code == 401

    # New password works
    new = await client.post(
        "/api/auth/login",
        json={"email": "pwdchange@example.com", "password": "newpassword456"},
    )
    assert new.status_code == 200
    assert "access_token" in new.json()


async def test_account_deletion_wipes_all_user_data(client):
    headers = await register_and_login(client, "delete-me@example.com")

    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "10", "description": "leftover", "date": "2026-05-01"},
    )
    await client.post(
        "/api/budgets",
        headers=headers,
        json={"category": "Food & Dining", "monthly_limit": "100", "month": "2026-05"},
    )
    await client.post(
        "/api/goals", headers=headers, json={"name": "g", "target_amount": "100"}
    )

    # Delete account
    resp = await client.delete("/api/auth/me", headers=headers)
    assert resp.status_code == 204

    # Token is still cryptographically valid but the user is gone — /me should 404
    me = await client.get("/api/auth/me", headers=headers)
    assert me.status_code == 404


async def test_data_export_returns_user_data(client):
    headers = await register_and_login(client, "export@example.com")

    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "9.99", "description": "Export me", "category": "Shopping", "date": "2026-05-05"},
    )
    await client.post(
        "/api/budgets",
        headers=headers,
        json={"category": "Shopping", "monthly_limit": "200", "month": "2026-05"},
    )

    resp = await client.get("/api/auth/export", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "export@example.com"
    assert len(body["transactions"]) == 1
    assert body["transactions"][0]["description"] == "Export me"
    assert len(body["budgets"]) == 1
    assert body["accounts"] == []
