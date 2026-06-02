from unittest.mock import AsyncMock, patch


async def _create_goal(client, headers, **kw):
    payload = {"name": "Goal", "target_amount": "1000", "current_amount": "0"}
    payload.update(kw)
    return (await client.post("/api/goals", headers=headers, json=payload)).json()


async def test_create_goal(client, headers):
    resp = await client.post(
        "/api/goals",
        headers=headers,
        json={"name": "Emergency fund", "target_amount": "5000", "current_amount": "1000"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Emergency fund"
    assert body["target_amount"] == "5000.00"
    assert body["current_amount"] == "1000.00"


async def test_create_goal_rejects_invalid_amounts(client, headers):
    resp = await client.post(
        "/api/goals",
        headers=headers,
        json={"name": "Bad goal", "target_amount": "0"},
    )
    assert resp.status_code == 400

    resp = await client.post(
        "/api/goals",
        headers=headers,
        json={"name": "Negative", "target_amount": "100", "current_amount": "-50"},
    )
    assert resp.status_code == 400


async def test_list_goals_only_returns_user_own(client, headers):
    await client.post("/api/goals", headers=headers, json={"name": "Mine", "target_amount": "100"})

    other = await client.post(
        "/api/auth/register",
        json={"email": "other2@example.com", "password": "password123"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    await client.post(
        "/api/goals", headers=other_headers, json={"name": "Theirs", "target_amount": "999"}
    )

    mine = await client.get("/api/goals", headers=headers)
    names = [g["name"] for g in mine.json()]
    assert "Mine" in names
    assert "Theirs" not in names


async def test_update_goal_progress(client, headers):
    created = await client.post(
        "/api/goals",
        headers=headers,
        json={"name": "Vacation", "target_amount": "2000", "current_amount": "500"},
    )
    goal_id = created.json()["id"]

    resp = await client.patch(
        f"/api/goals/{goal_id}", headers=headers, json={"current_amount": "1250"}
    )
    assert resp.status_code == 200
    assert resp.json()["current_amount"] == "1250.00"


async def test_delete_goal(client, headers):
    created = await client.post(
        "/api/goals", headers=headers, json={"name": "Tmp", "target_amount": "100"}
    )
    goal_id = created.json()["id"]

    resp = await client.delete(f"/api/goals/{goal_id}", headers=headers)
    assert resp.status_code == 204

    listing = await client.get("/api/goals", headers=headers)
    assert all(g["id"] != goal_id for g in listing.json())


async def test_goals_require_auth(client):
    resp = await client.get("/api/goals")
    assert resp.status_code == 403


async def test_add_manual_contribution_increments_goal(client, headers):
    goal = await _create_goal(client, headers, current_amount="100")
    resp = await client.post(
        f"/api/goals/{goal['id']}/contributions", headers=headers, json={"amount": "250"}
    )
    assert resp.status_code == 201
    assert resp.json()["amount"] == "250.00"
    assert resp.json()["source"] == "manual"

    updated = (await client.get("/api/goals", headers=headers)).json()[0]
    assert updated["current_amount"] == "350.00"


async def test_contribution_linked_to_transaction_prevents_double(client, headers):
    goal = await _create_goal(client, headers)
    tx = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "200", "description": "Transfer to Savings", "category": "Other", "date": "2026-05-01"},
    )
    tx_id = tx.json()["id"]

    first = await client.post(
        f"/api/goals/{goal['id']}/contributions",
        headers=headers,
        json={"transaction_id": tx_id, "amount": "200"},
    )
    assert first.status_code == 201
    assert first.json()["source"] == "ai"
    assert first.json()["transaction_id"] == tx_id

    second = await client.post(
        f"/api/goals/{goal['id']}/contributions",
        headers=headers,
        json={"transaction_id": tx_id, "amount": "200"},
    )
    assert second.status_code == 409


async def test_delete_contribution_decrements_goal(client, headers):
    goal = await _create_goal(client, headers, current_amount="100")
    created = await client.post(
        f"/api/goals/{goal['id']}/contributions", headers=headers, json={"amount": "200"}
    )
    contribution_id = created.json()["id"]
    after_add = (await client.get("/api/goals", headers=headers)).json()[0]
    assert after_add["current_amount"] == "300.00"

    resp = await client.delete(f"/api/goals/contributions/{contribution_id}", headers=headers)
    assert resp.status_code == 204

    after_del = (await client.get("/api/goals", headers=headers)).json()[0]
    assert after_del["current_amount"] == "100.00"


async def test_list_contributions_returns_history(client, headers):
    goal = await _create_goal(client, headers)
    await client.post(
        f"/api/goals/{goal['id']}/contributions", headers=headers, json={"amount": "50", "note": "first"}
    )
    resp = await client.get(f"/api/goals/{goal['id']}/contributions", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["note"] == "first"


async def test_contribution_rejects_other_users_goal(client, headers):
    other = await client.post(
        "/api/auth/register", json={"email": "cother@example.com", "password": "password123"}
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    other_goal = await _create_goal(client, other_headers)

    resp = await client.post(
        f"/api/goals/{other_goal['id']}/contributions", headers=headers, json={"amount": "50"}
    )
    assert resp.status_code == 404


async def test_contributions_require_auth(client):
    resp = await client.get("/api/goals/suggestions")
    assert resp.status_code == 403


async def test_suggestions_empty_without_goals(client, headers):
    resp = await client.get("/api/goals/suggestions", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_suggestions_returns_ai_matches(client, headers):
    goal = await _create_goal(client, headers, name="Emergency Fund")
    tx = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "400", "description": "Transfer to Ally Savings", "category": "Other", "date": "2026-05-02"},
    )
    tx_id = tx.json()["id"]

    mapped = [{"transaction_id": tx_id, "goal_id": goal["id"], "reason": "savings transfer"}]
    with patch("app.routes.goals.suggest_goal_contributions", AsyncMock(return_value=mapped)):
        resp = await client.get("/api/goals/suggestions", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["goal_name"] == "Emergency Fund"
    assert body[0]["transaction_id"] == tx_id
    assert body[0]["reason"] == "savings transfer"


async def test_accepted_suggestion_is_not_resuggested(client, headers):
    goal = await _create_goal(client, headers, name="Emergency Fund")
    tx = await client.post(
        "/api/transactions",
        headers=headers,
        json={"amount": "400", "description": "Transfer to Ally Savings", "category": "Other", "date": "2026-05-02"},
    )
    tx_id = tx.json()["id"]
    await client.post(
        f"/api/goals/{goal['id']}/contributions",
        headers=headers,
        json={"transaction_id": tx_id, "amount": "400"},
    )

    mapped = [{"transaction_id": tx_id, "goal_id": goal["id"], "reason": "savings"}]
    with patch("app.routes.goals.suggest_goal_contributions", AsyncMock(return_value=mapped)):
        resp = await client.get("/api/goals/suggestions", headers=headers)
    # The linked transaction is filtered out before the AI runs, so nothing is suggested.
    assert resp.json() == []
