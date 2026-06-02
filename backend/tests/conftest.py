import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["TESTING"] = "true"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5432/budgeting_test"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["PLAID_ENV"] = "sandbox"
os.environ["PLAID_CLIENT_ID"] = "test-client"
os.environ["PLAID_SECRET"] = "test-secret"
os.environ["ANTHROPIC_API_KEY"] = "test-anthropic"
os.environ["ENCRYPTION_KEY"] = "M0vWZpVH8YbHpJ8XAxXqB9ZBVbVT8oxTgPnFwQGCWNk="

from app.database import Base, get_db
from app.main import app

TEST_DB_URL = os.environ["DATABASE_URL"]
test_engine = create_async_engine(TEST_DB_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await test_engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def clean_tables():
    async with test_engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE goals, budgets, transactions, accounts, users CASCADE"))
    yield


async def override_get_db():
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def mock_external_services():
    sample_sync = {
        "added": [],
        "modified": [],
        "removed": [],
        "next_cursor": "cursor-1",
        "has_more": False,
    }
    with patch("app.routes.transactions.categorize_transaction", AsyncMock(return_value="Food & Dining")), \
         patch("app.routes.plaid.categorize_transaction", AsyncMock(return_value="Food & Dining")), \
         patch("app.routes.goals.suggest_goal_contributions", AsyncMock(return_value=[])), \
         patch("app.routes.transactions.parse_search_query", AsyncMock(return_value={"text": None, "interpretation": "All results"})), \
         patch("app.routes.auth.send_email", AsyncMock(return_value=None)), \
         patch("app.lib.plaid.create_link_token", AsyncMock(return_value="link-sandbox-fake")), \
         patch("app.lib.plaid.exchange_public_token", AsyncMock(return_value=("access-fake", "item-fake"))), \
         patch("app.lib.plaid.sync_transactions", AsyncMock(return_value=sample_sync)), \
         patch("app.lib.plaid.get_recurring", AsyncMock(return_value={"outflow_streams": [], "inflow_streams": []})), \
         patch("app.lib.plaid.get_accounts", AsyncMock(return_value=[])):
        yield


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def auth_token(client):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "password123"},
    )
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest_asyncio.fixture
async def db_session():
    async with TestSession() as session:
        yield session
