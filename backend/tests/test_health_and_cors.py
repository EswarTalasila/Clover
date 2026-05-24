"""Public infrastructure endpoints: /health and CORS handling."""


async def test_health_endpoint_returns_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_health_endpoint_is_public(client):
    """No auth required for healthcheck."""
    resp = await client.get("/health")
    assert resp.status_code == 200


async def test_cors_preflight_returns_allow_origin_for_localhost(client):
    """Localhost is always in CORS allowlist via DEV_ORIGINS."""
    resp = await client.options(
        "/api/budgets/trend",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "GET" in resp.headers.get("access-control-allow-methods", "")


async def test_cors_preflight_rejects_unlisted_origin(client):
    """Random origins should not get an allow-origin header (browser blocks)."""
    resp = await client.options(
        "/api/budgets/trend",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert resp.headers.get("access-control-allow-origin") != "https://evil.example.com"


async def test_actual_get_response_has_cors_headers_for_allowed_origin(client):
    """The actual GET (not just preflight) should include CORS headers."""
    register = await client.post(
        "/api/auth/register",
        json={"email": "cors@example.com", "password": "password123"},
    )
    token = register.json()["access_token"]

    resp = await client.get(
        "/api/auth/me",
        headers={
            "Authorization": f"Bearer {token}",
            "Origin": "http://localhost:5173",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"


async def test_openapi_docs_available(client):
    """Sanity: /docs and openapi.json available (for dev)."""
    resp = await client.get("/openapi.json")
    assert resp.status_code == 200
    spec = resp.json()
    assert spec["info"]["title"] == "Clover API"
    paths = spec["paths"]
    # Spot-check that our routes are documented
    assert any("/api/auth/login" in p for p in paths)
    assert any("/api/transactions" in p for p in paths)
    assert any("/api/goals" in p for p in paths)
