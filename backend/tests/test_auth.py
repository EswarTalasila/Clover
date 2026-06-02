async def test_register_creates_user_and_returns_token(client):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 20


async def test_register_rejects_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "password123"}
    first = await client.post("/api/auth/register", json=payload)
    assert first.status_code == 200

    second = await client.post("/api/auth/register", json=payload)
    assert second.status_code == 400
    assert "already registered" in second.json()["detail"].lower()


async def test_login_returns_token_for_valid_credentials(client):
    await client.post(
        "/api/auth/register",
        json={"email": "login@example.com", "password": "password123"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_login_rejects_wrong_password(client):
    await client.post(
        "/api/auth/register",
        json={"email": "wrong@example.com", "password": "password123"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "wrong@example.com", "password": "badpass"},
    )
    assert resp.status_code == 401


async def test_login_rejects_unknown_user(client):
    resp = await client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )
    assert resp.status_code == 401


async def test_me_requires_auth(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 403


async def test_me_returns_user_info(client, headers):
    resp = await client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "test@example.com"


async def test_demo_creates_account_with_sample_data(client):
    resp = await client.post("/api/auth/demo")
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    assert len(token) > 20
    headers = {"Authorization": f"Bearer {token}"}

    me = await client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"].startswith("demo-")

    txns = await client.get("/api/transactions", headers=headers)
    assert txns.status_code == 200
    assert len(txns.json()) > 20

    goals = await client.get("/api/goals", headers=headers)
    assert goals.status_code == 200
    assert len(goals.json()) == 4

    month = __import__("datetime").date.today().strftime("%Y-%m")
    budgets = await client.get("/api/budgets", params={"month": month}, headers=headers)
    assert budgets.status_code == 200
    assert len(budgets.json()) > 0


async def test_demo_accounts_are_isolated(client):
    a = (await client.post("/api/auth/demo")).json()["access_token"]
    b = (await client.post("/api/auth/demo")).json()["access_token"]
    assert a != b

    me_a = (await client.get("/api/auth/me", headers={"Authorization": f"Bearer {a}"})).json()
    me_b = (await client.get("/api/auth/me", headers={"Authorization": f"Bearer {b}"})).json()
    assert me_a["email"] != me_b["email"]


async def test_export_excludes_plaid_access_token(client, headers):
    await client.post(
        "/api/plaid/exchange-token",
        json={"public_token": "public-sandbox-x", "institution_name": "Test Bank"},
        headers=headers,
    )
    resp = await client.get("/api/auth/export", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["accounts"]) == 1
    for account in data["accounts"]:
        assert "plaid_access_token" not in account
    # The decrypted token value must not leak anywhere in the payload.
    assert "access-fake" not in resp.text
