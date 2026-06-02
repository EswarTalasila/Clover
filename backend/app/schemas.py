import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: uuid.UUID
    email: str

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class TransactionCreate(BaseModel):
    amount: Decimal
    description: str
    category: str | None = None
    date: date


class TransactionUpdate(BaseModel):
    category: str | None = None
    description: str | None = None
    notes: str | None = None
    excluded: bool | None = None


class TransactionOut(BaseModel):
    id: uuid.UUID
    amount: Decimal
    description: str
    merchant_name: str | None = None
    merchant_website: str | None = None
    merchant_logo_url: str | None = None
    iso_currency_code: str | None = None
    authorized_date: date | None = None
    category: str | None
    category_detailed: str | None = None
    payment_channel: str | None = None
    pending: bool = False
    location_city: str | None = None
    location_region: str | None = None
    notes: str | None = None
    date: date
    is_manual: bool
    excluded: bool = False
    account_institution: str | None = None

    model_config = {"from_attributes": True}


class BudgetCreate(BaseModel):
    category: str
    monthly_limit: Decimal
    month: str


class BudgetOut(BaseModel):
    id: uuid.UUID
    category: str
    monthly_limit: Decimal
    month: str

    model_config = {"from_attributes": True}


class BudgetSummaryItem(BaseModel):
    category: str
    monthly_limit: Decimal | None
    spent: Decimal
    remaining: Decimal | None


class PlaidLinkTokenResponse(BaseModel):
    link_token: str


class PlaidExchangeRequest(BaseModel):
    public_token: str
    institution_name: str | None = None


class AccountOut(BaseModel):
    id: uuid.UUID
    institution_name: str | None
    last_cursor: str | None

    model_config = {"from_attributes": True}


class PlaidSyncResponse(BaseModel):
    added: int
    modified: int
    removed: int


class AccountBalance(BaseModel):
    institution: str | None
    name: str
    type: str
    subtype: str | None
    mask: str | None
    current: Decimal | None
    available: Decimal | None
    currency: str | None


class NetWorthResponse(BaseModel):
    assets: Decimal
    liabilities: Decimal
    net_worth: Decimal
    accounts: list[AccountBalance]


class TopMerchant(BaseModel):
    merchant: str
    spent: Decimal
    transaction_count: int


class GoalCreate(BaseModel):
    name: str
    target_amount: Decimal
    current_amount: Decimal = Decimal("0")
    target_date: date | None = None
    note: str | None = None


class GoalUpdate(BaseModel):
    name: str | None = None
    target_amount: Decimal | None = None
    current_amount: Decimal | None = None
    target_date: date | None = None
    note: str | None = None


class GoalOut(BaseModel):
    id: uuid.UUID
    name: str
    target_amount: Decimal
    current_amount: Decimal
    target_date: date | None
    note: str | None

    model_config = {"from_attributes": True}


class ContributionCreate(BaseModel):
    transaction_id: uuid.UUID | None = None
    amount: Decimal
    note: str | None = None


class ContributionOut(BaseModel):
    id: uuid.UUID
    goal_id: uuid.UUID
    transaction_id: uuid.UUID | None
    amount: Decimal
    source: str
    note: str | None
    created_at: datetime
    transaction_description: str | None = None
    transaction_date: date | None = None

    model_config = {"from_attributes": True}


class GoalSuggestion(BaseModel):
    transaction_id: uuid.UUID
    description: str
    merchant_name: str | None
    amount: Decimal
    date: date
    goal_id: uuid.UUID
    goal_name: str
    reason: str


class AiSearchResponse(BaseModel):
    interpretation: str
    results: list[TransactionOut]
