import re
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.models import PasswordResetToken


def _token_from(send_mock):
    body = send_mock.call_args.kwargs["body"]
    return re.search(r"token=([\w\-]+)", body).group(1)


async def test_forgot_password_is_generic_for_unknown_email(client):
    resp = await client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert resp.status_code == 200
    assert "reset link has been sent" in resp.json()["message"].lower()


async def test_forgot_password_stores_only_a_hash(client, db_session):
    await client.post("/api/auth/register", json={"email": "known@example.com", "password": "oldpassword1"})
    with patch("app.routes.auth.send_email", AsyncMock()) as mock_send:
        await client.post("/api/auth/forgot-password", json={"email": "known@example.com"})
        raw = _token_from(mock_send)

    tokens = (await db_session.execute(select(PasswordResetToken))).scalars().all()
    assert len(tokens) == 1
    assert len(tokens[0].token_hash) == 64  # sha256 hex digest
    assert tokens[0].token_hash != raw  # the raw token is never stored


async def test_full_reset_flow_changes_password(client):
    await client.post("/api/auth/register", json={"email": "reset@example.com", "password": "oldpassword1"})

    with patch("app.routes.auth.send_email", AsyncMock()) as mock_send:
        forgot = await client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})
        assert forgot.status_code == 200
        assert mock_send.called
        token = _token_from(mock_send)

    reset = await client.post(
        "/api/auth/reset-password", json={"token": token, "new_password": "newpassword2"}
    )
    assert reset.status_code == 200

    old = await client.post("/api/auth/login", json={"email": "reset@example.com", "password": "oldpassword1"})
    assert old.status_code == 401
    new = await client.post("/api/auth/login", json={"email": "reset@example.com", "password": "newpassword2"})
    assert new.status_code == 200


async def test_reset_token_is_single_use(client):
    await client.post("/api/auth/register", json={"email": "single@example.com", "password": "oldpassword1"})
    with patch("app.routes.auth.send_email", AsyncMock()) as mock_send:
        await client.post("/api/auth/forgot-password", json={"email": "single@example.com"})
        token = _token_from(mock_send)

    first = await client.post("/api/auth/reset-password", json={"token": token, "new_password": "newpassword2"})
    assert first.status_code == 200
    second = await client.post("/api/auth/reset-password", json={"token": token, "new_password": "thirdpass3"})
    assert second.status_code == 400


async def test_reset_rejects_unknown_token(client):
    resp = await client.post(
        "/api/auth/reset-password", json={"token": "definitely-not-valid", "new_password": "whatever12"}
    )
    assert resp.status_code == 400


async def test_reset_enforces_password_length(client):
    await client.post("/api/auth/register", json={"email": "len@example.com", "password": "oldpassword1"})
    with patch("app.routes.auth.send_email", AsyncMock()) as mock_send:
        await client.post("/api/auth/forgot-password", json={"email": "len@example.com"})
        token = _token_from(mock_send)

    resp = await client.post("/api/auth/reset-password", json={"token": token, "new_password": "short"})
    assert resp.status_code == 422  # blocked by schema min_length


async def test_new_request_invalidates_previous_token(client):
    await client.post("/api/auth/register", json={"email": "rotate@example.com", "password": "oldpassword1"})
    with patch("app.routes.auth.send_email", AsyncMock()) as mock_send:
        await client.post("/api/auth/forgot-password", json={"email": "rotate@example.com"})
        first_token = _token_from(mock_send)
    with patch("app.routes.auth.send_email", AsyncMock()) as mock_send:
        await client.post("/api/auth/forgot-password", json={"email": "rotate@example.com"})
        second_token = _token_from(mock_send)

    # The first link should no longer work; the latest one should.
    stale = await client.post("/api/auth/reset-password", json={"token": first_token, "new_password": "newpassword2"})
    assert stale.status_code == 400
    fresh = await client.post("/api/auth/reset-password", json={"token": second_token, "new_password": "newpassword2"})
    assert fresh.status_code == 200
