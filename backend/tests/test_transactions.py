import uuid
from datetime import date, timedelta

import pytest_asyncio
from sqlalchemy import select

from app.models import Account, Transaction, User


async def make_tx(db_session, email, **kwargs):
    user = (await db_session.execute(select(User).where(User.email == email))).scalar_one()
    defaults = dict(
        user_id=user.id,
        amount=10,
        description="Default",
        category="Food & Dining",
        date=date.today(),
        is_manual=True,
    )
    defaults.update(kwargs)
    tx = Transaction(**defaults)
    db_session.add(tx)
    await db_session.commit()
    await db_session.refresh(tx)
    return tx


async def test_create_manual_transaction(client, headers):
    resp = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "12.50", "description": "Coffee", "date": "2026-05-01"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["description"] == "Coffee"
    assert body["category"] == "Food & Dining"
    assert body["is_manual"] is True


async def test_create_transaction_uses_provided_category(client, headers):
    resp = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "12.50", "description": "Gas", "category": "Transportation", "date": "2026-05-01"},
    )
    assert resp.json()["category"] == "Transportation"


async def test_list_filter_handles_december(client, headers):
    for d in ["2026-11-15", "2026-12-15", "2027-01-15"]:
        await client.post(
            "/api/transactions",
            headers=headers,
            json={"amount": "5", "description": "Test", "date": d},
        )
    resp = await client.get("/api/transactions?month=2026-12", headers=headers)
    assert resp.status_code == 200
    dates = [t["date"] for t in resp.json()]
    assert dates == ["2026-12-15"]


async def test_list_filters_by_month(client, headers, db_session):
    for d in ["2026-04-15", "2026-05-01", "2026-05-20"]:
        await client.post(
            "/api/transactions",
            headers=headers,
            json={"amount": "5", "description": "Test", "date": d},
        )

    resp = await client.get("/api/transactions?month=2026-05", headers=headers)
    assert resp.status_code == 200
    dates = [t["date"] for t in resp.json()]
    assert all(d.startswith("2026-05") for d in dates)
    assert len(dates) == 2


async def test_list_only_returns_users_own_transactions(client, headers, db_session):
    await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "5", "description": "Mine", "date": "2026-05-01"},
    )

    other = await client.post(
        "/api/auth/register",
        json={"email": "other@example.com", "password": "password123"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    await client.post(
        "/api/transactions",
        headers=other_headers,
        json={"amount": "99", "description": "Theirs", "date": "2026-05-01"},
    )

    mine = await client.get("/api/transactions", headers=headers)
    descriptions = [t["description"] for t in mine.json()]
    assert "Mine" in descriptions
    assert "Theirs" not in descriptions


async def test_patch_updates_notes_and_category(client, headers):
    created = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "5", "description": "Test", "date": "2026-05-01"},
    )
    tx_id = created.json()["id"]

    resp = await client.patch(
        f"/api/transactions/{tx_id}",
        headers=headers,
        json={"notes": "Birthday gift", "category": "Shopping"},
    )
    assert resp.status_code == 200
    assert resp.json()["notes"] == "Birthday gift"
    assert resp.json()["category"] == "Shopping"


async def test_patch_excludes_transaction(client, headers):
    created = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "5", "description": "Test", "date": "2026-05-01"},
    )
    tx_id = created.json()["id"]

    resp = await client.patch(
        f"/api/transactions/{tx_id}",
        headers=headers,
        json={"excluded": True},
    )
    assert resp.json()["excluded"] is True


async def test_delete_manual_transaction_works(client, headers):
    created = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "5", "description": "Test", "date": "2026-05-01"},
    )
    tx_id = created.json()["id"]

    resp = await client.delete(f"/api/transactions/{tx_id}", headers=headers)
    assert resp.status_code == 204


async def test_delete_plaid_transaction_blocked(client, headers, db_session):
    tx = await make_tx(db_session, "test@example.com", is_manual=False)

    resp = await client.delete(f"/api/transactions/{tx.id}", headers=headers)
    assert resp.status_code == 400
    assert "cannot be deleted" in resp.json()["detail"].lower()


async def test_recategorize_calls_claude_for_other(client, headers, db_session):
    await make_tx(db_session, "test@example.com", category="Other", description="Trader Joes")
    await make_tx(db_session, "test@example.com", category="Food & Dining", description="Burger")

    resp = await client.post("/api/transactions/recategorize", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["updated"] == 1


async def test_transactions_require_auth(client):
    resp = await client.get("/api/transactions")
    assert resp.status_code == 403


async def test_top_merchants_aggregates_and_orders(client, headers, db_session):
    await make_tx(db_session, "test@example.com", merchant_name="Starbucks", amount=5)
    await make_tx(db_session, "test@example.com", merchant_name="Starbucks", amount=7)
    await make_tx(db_session, "test@example.com", merchant_name="Amazon", amount=50)
    await make_tx(db_session, "test@example.com", merchant_name="REI", amount=100)
    await make_tx(db_session, "test@example.com", merchant_name="REI", amount=999, excluded=True)
    await make_tx(db_session, "test@example.com", merchant_name="Employer", amount=2000, category="Income")

    resp = await client.get("/api/transactions/top-merchants?limit=3", headers=headers)
    assert resp.status_code == 200
    merchants = resp.json()
    assert merchants[0]["merchant"] == "REI"
    assert merchants[0]["spent"] == "100.00"
    assert merchants[1]["merchant"] == "Amazon"
    assert merchants[2]["merchant"] == "Starbucks"
    assert merchants[2]["spent"] == "12.00"
    assert merchants[2]["transaction_count"] == 2


async def test_top_merchants_filters_by_month(client, headers, db_session):
    await make_tx(db_session, "test@example.com", merchant_name="MayBuy", amount=20, date=date(2026, 5, 10))
    await make_tx(db_session, "test@example.com", merchant_name="AprilBuy", amount=30, date=date(2026, 4, 10))

    resp = await client.get("/api/transactions/top-merchants?month=2026-05", headers=headers)
    assert resp.status_code == 200
    merchants = [m["merchant"] for m in resp.json()]
    assert "MayBuy" in merchants
    assert "AprilBuy" not in merchants


async def test_search_matches_description_merchant_and_notes(client, headers, db_session):
    await make_tx(db_session, "test@example.com", description="Morning coffee", merchant_name="Blue Bottle")
    await make_tx(db_session, "test@example.com", description="Lunch", merchant_name="Sweetgreen", notes="coffee meeting")
    await make_tx(db_session, "test@example.com", description="Gas", merchant_name="Shell")

    by_desc = await client.get("/api/transactions/search?q=coffee", headers=headers)
    assert by_desc.status_code == 200
    found = {t["description"] for t in by_desc.json()}
    assert found == {"Morning coffee", "Lunch"}  # matches description and notes

    by_merchant = await client.get("/api/transactions/search?q=shell", headers=headers)
    assert [t["merchant_name"] for t in by_merchant.json()] == ["Shell"]


async def test_search_empty_query_returns_empty(client, headers, db_session):
    await make_tx(db_session, "test@example.com", description="Anything")
    resp = await client.get("/api/transactions/search?q=%20%20", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_search_respects_limit(client, headers, db_session):
    for i in range(5):
        await make_tx(db_session, "test@example.com", description=f"Subscription {i}")
    resp = await client.get("/api/transactions/search?q=subscription&limit=2", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_search_escapes_sql_wildcards(client, headers, db_session):
    await make_tx(db_session, "test@example.com", description="50% off sale")
    await make_tx(db_session, "test@example.com", description="regular price")
    resp = await client.get("/api/transactions/search?q=%25", headers=headers)  # q = "%"
    assert resp.status_code == 200
    descriptions = [t["description"] for t in resp.json()]
    assert descriptions == ["50% off sale"]  # literal %, not a match-all wildcard


async def test_search_requires_auth(client):
    resp = await client.get("/api/transactions/search?q=coffee")
    assert resp.status_code == 403


async def test_search_only_returns_own_transactions(client, headers, db_session):
    await make_tx(db_session, "test@example.com", description="My latte")

    other = await client.post(
        "/api/auth/register",
        json={"email": "searcher@example.com", "password": "password123"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    await make_tx(db_session, "searcher@example.com", description="Their latte")

    resp = await client.get("/api/transactions/search?q=latte", headers=headers)
    descriptions = [t["description"] for t in resp.json()]
    assert descriptions == ["My latte"]
