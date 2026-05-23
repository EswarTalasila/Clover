import os
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.transactions_recurring_get_request import TransactionsRecurringGetRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode

_env_map = {
    "sandbox": plaid.Environment.Sandbox,
    "production": plaid.Environment.Production,
}

configuration = plaid.Configuration(
    host=_env_map.get(os.getenv("PLAID_ENV", "sandbox")),
    api_key={
        "clientId": os.getenv("PLAID_CLIENT_ID"),
        "secret": os.getenv("PLAID_SECRET"),
    },
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)


async def create_link_token(user_id: str) -> str:
    request = LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="Clover",
        country_codes=[CountryCode("US")],
        language="en",
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
    )
    response = client.link_token_create(request)
    return response["link_token"]


async def exchange_public_token(public_token: str) -> tuple[str, str]:
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = client.item_public_token_exchange(request)
    return response["access_token"], response["item_id"]


async def get_account_ids(access_token: str) -> list[str]:
    request = AccountsGetRequest(access_token=access_token)
    response = client.accounts_get(request)
    return [a["account_id"] for a in response["accounts"]]


async def get_recurring(access_token: str) -> dict:
    account_ids = await get_account_ids(access_token)
    request = TransactionsRecurringGetRequest(
        access_token=access_token,
        account_ids=account_ids,
    )
    response = client.transactions_recurring_get(request)
    return {
        "inflow_streams": [s.to_dict() for s in response["inflow_streams"]],
        "outflow_streams": [s.to_dict() for s in response["outflow_streams"]],
    }


async def sync_transactions(access_token: str, cursor: str | None = None) -> dict:
    kwargs = {"access_token": access_token}
    if cursor:
        kwargs["cursor"] = cursor
    request = TransactionsSyncRequest(**kwargs)
    response = client.transactions_sync(request)
    return {
        "added": [t.to_dict() for t in response["added"]],
        "modified": [t.to_dict() for t in response["modified"]],
        "removed": [t.to_dict() for t in response["removed"]],
        "next_cursor": response["next_cursor"],
        "has_more": response["has_more"],
    }
