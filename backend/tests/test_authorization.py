"""
Authorization tests. Ensure:
1. Every protected route returns 403 without auth.
2. User A cannot read/modify/delete user B's data.
3. Invalid tokens are rejected.
"""

import pytest


PROTECTED_GET_PATHS = [
    "/api/auth/me",
    "/api/auth/export",
    "/api/transactions",
    "/api/transactions/top-merchants",
    "/api/budgets?month=2026-05",
    "/api/budgets/summary?month=2026-05",
    "/api/budgets/trend?months=6",
    "/api/plaid/accounts",
    "/api/plaid/recurring",
    "/api/plaid/balances",
    "/api/goals",
]


@pytest.mark.parametrize("path", PROTECTED_GET_PATHS)
async def test_protected_get_requires_auth(client, path):
    resp = await client.get(path)
    assert resp.status_code == 403, f"{path} should require auth"


async def test_invalid_jwt_rejected(client):
    bad_headers = {"Authorization": "Bearer not-a-valid-jwt"}
    resp = await client.get("/api/auth/me", headers=bad_headers)
    assert resp.status_code == 401


async def test_missing_bearer_scheme_rejected(client):
    bad_headers = {"Authorization": "just-a-string"}
    resp = await client.get("/api/auth/me", headers=bad_headers)
    assert resp.status_code == 403  # HTTPBearer rejects malformed schemes


async def test_jwt_signed_with_wrong_secret_rejected(client):
    from jose import jwt
    from datetime import datetime, timedelta
    import uuid

    forged = jwt.encode(
        {"sub": str(uuid.uuid4()), "exp": datetime.utcnow() + timedelta(days=1)},
        "WRONG_SECRET",
        algorithm="HS256",
    )
    resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert resp.status_code == 401


async def _make_two_users(client):
    """Returns (alice_headers, bob_headers) — two distinct authenticated users."""
    a = await client.post(
        "/api/auth/register", json={"email": "alice@example.com", "password": "password123"}
    )
    b = await client.post(
        "/api/auth/register", json={"email": "bob@example.com", "password": "password123"}
    )
    return (
        {"Authorization": f"Bearer {a.json()['access_token']}"},
        {"Authorization": f"Bearer {b.json()['access_token']}"},
    )


async def test_user_cannot_see_other_users_transactions(client):
    alice, bob = await _make_two_users(client)
    await client.post(
        "/api/transactions",
        headers=alice,
        json={"amount": "10", "description": "Alice secret", "date": "2026-05-01"},
    )

    bob_view = await client.get("/api/transactions", headers=bob)
    descriptions = [t["description"] for t in bob_view.json()]
    assert "Alice secret" not in descriptions


async def test_user_cannot_modify_other_users_transaction(client):
    alice, bob = await _make_two_users(client)
    created = await client.post(
        "/api/transactions",
        headers=alice,
        json={"amount": "10", "description": "Alice tx", "date": "2026-05-01"},
    )
    tx_id = created.json()["id"]

    # Bob tries to PATCH
    patch_resp = await client.patch(
        f"/api/transactions/{tx_id}", headers=bob, json={"notes": "I was here"}
    )
    assert patch_resp.status_code == 404, "Bob should not be able to find Alice's transaction"

    # Bob tries to DELETE
    delete_resp = await client.delete(f"/api/transactions/{tx_id}", headers=bob)
    assert delete_resp.status_code == 404


async def test_user_cannot_see_other_users_budgets(client):
    alice, bob = await _make_two_users(client)
    await client.post(
        "/api/budgets",
        headers=alice,
        json={"category": "Food & Dining", "monthly_limit": "300", "month": "2026-05"},
    )

    bob_view = await client.get("/api/budgets?month=2026-05", headers=bob)
    assert bob_view.json() == []


async def test_user_cannot_delete_other_users_budget(client):
    alice, bob = await _make_two_users(client)
    created = await client.post(
        "/api/budgets",
        headers=alice,
        json={"category": "Food & Dining", "monthly_limit": "300", "month": "2026-05"},
    )
    budget_id = created.json()["id"]

    resp = await client.delete(f"/api/budgets/{budget_id}", headers=bob)
    assert resp.status_code == 404

    # Alice's budget still exists
    alice_view = await client.get("/api/budgets?month=2026-05", headers=alice)
    assert len(alice_view.json()) == 1


async def test_user_cannot_see_other_users_goals(client):
    alice, bob = await _make_two_users(client)
    await client.post(
        "/api/goals", headers=alice, json={"name": "Alice goal", "target_amount": "100"}
    )

    bob_view = await client.get("/api/goals", headers=bob)
    assert bob_view.json() == []


async def test_user_cannot_modify_other_users_goal(client):
    alice, bob = await _make_two_users(client)
    created = await client.post(
        "/api/goals", headers=alice, json={"name": "Alice goal", "target_amount": "100"}
    )
    goal_id = created.json()["id"]

    patch_resp = await client.patch(
        f"/api/goals/{goal_id}", headers=bob, json={"current_amount": "999"}
    )
    assert patch_resp.status_code == 404

    delete_resp = await client.delete(f"/api/goals/{goal_id}", headers=bob)
    assert delete_resp.status_code == 404


async def test_user_cannot_reset_or_disconnect_other_users_plaid_account(client, db_session):
    from app.models import Account, User
    from sqlalchemy import select
    import uuid

    alice, bob = await _make_two_users(client)

    alice_user = (
        await db_session.execute(select(User).where(User.email == "alice@example.com"))
    ).scalar_one()
    account = Account(
        user_id=alice_user.id,
        plaid_access_token="access-fake-alice",
        plaid_item_id="item-alice",
        institution_name="Alice Bank",
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    reset_resp = await client.post(f"/api/plaid/accounts/{account.id}/reset", headers=bob)
    assert reset_resp.status_code == 404

    disconnect_resp = await client.delete(f"/api/plaid/accounts/{account.id}", headers=bob)
    assert disconnect_resp.status_code == 404


async def test_data_export_only_includes_own_data(client):
    alice, bob = await _make_two_users(client)
    await client.post(
        "/api/transactions",
        headers=alice,
        json={"amount": "10", "description": "Alice tx", "date": "2026-05-01"},
    )
    await client.post(
        "/api/transactions",
        headers=bob,
        json={"amount": "20", "description": "Bob tx", "date": "2026-05-01"},
    )

    alice_export = await client.get("/api/auth/export", headers=alice)
    alice_descriptions = [t["description"] for t in alice_export.json()["transactions"]]
    assert "Alice tx" in alice_descriptions
    assert "Bob tx" not in alice_descriptions
