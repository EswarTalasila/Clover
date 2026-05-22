import uuid
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TransactionCreate(BaseModel):
    amount: Decimal
    description: str
    category: str | None = None
    date: date


class TransactionUpdate(BaseModel):
    category: str | None = None
    description: str | None = None


class TransactionOut(BaseModel):
    id: uuid.UUID
    amount: Decimal
    description: str
    category: str | None
    date: date
    is_manual: bool

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
    monthly_limit: Decimal
    spent: Decimal
    remaining: Decimal


class PlaidLinkTokenResponse(BaseModel):
    link_token: str


class PlaidExchangeRequest(BaseModel):
    public_token: str
    institution_name: str | None = None
