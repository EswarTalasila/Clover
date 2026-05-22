import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, Boolean, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    accounts: Mapped[list["Account"]] = relationship(back_populates="user")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user")
    budgets: Mapped[list["Budget"]] = relationship(back_populates="user")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plaid_access_token: Mapped[str] = mapped_column(String, nullable=False)
    plaid_item_id: Mapped[str] = mapped_column(String, nullable=False)
    institution_name: Mapped[str] = mapped_column(String, nullable=True)
    last_cursor: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="accounts")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    plaid_transaction_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="transactions")
    account: Mapped["Account | None"] = relationship(back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    monthly_limit: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    month: Mapped[str] = mapped_column(String, nullable=False)

    user: Mapped["User"] = relationship(back_populates="budgets")

    __table_args__ = (UniqueConstraint("user_id", "category", "month"),)
