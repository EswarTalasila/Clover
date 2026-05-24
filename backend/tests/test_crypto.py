"""Tests for the EncryptedString TypeDecorator and crypto helpers."""

from app.lib.crypto import encrypt, decrypt, _ENC_PREFIX


def test_encrypt_returns_prefixed_string():
    token = encrypt("secret-value")
    assert token.startswith(_ENC_PREFIX)
    assert token != "secret-value"


def test_round_trip():
    original = "access-sandbox-12345-abc"
    encrypted = encrypt(original)
    decrypted = decrypt(encrypted)
    assert decrypted == original


def test_decrypt_handles_legacy_plaintext():
    """Existing rows pre-encryption should be returned as-is (no enc1: prefix)."""
    plaintext = "access-sandbox-not-encrypted"
    assert decrypt(plaintext) == plaintext


def test_decrypt_invalid_ciphertext_returns_input_unchanged():
    bad = f"{_ENC_PREFIX}garbage-not-actually-encrypted"
    # Should NOT crash; returns the raw value as a defensive fallback
    result = decrypt(bad)
    assert result == bad


def test_encrypt_decrypt_none_passthrough():
    assert encrypt(None) is None
    assert decrypt(None) is None


def test_encrypt_different_each_time():
    """Fernet includes a timestamp + IV, so two encryptions of the same value differ."""
    a = encrypt("same-value")
    b = encrypt("same-value")
    assert a != b
    assert decrypt(a) == decrypt(b) == "same-value"


async def test_encrypted_string_round_trip_via_orm(db_session):
    """When a token is stored via SQLAlchemy, it's encrypted at rest and decrypted on read."""
    import uuid
    from sqlalchemy import select, text
    from app.models import Account, User

    user = User(
        email="crypto-orm@example.com",
        hashed_password="bcrypt-hash-here",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    secret_token = "access-prod-supersecret"
    account = Account(
        user_id=user.id,
        plaid_access_token=secret_token,
        plaid_item_id="item-123",
        institution_name="Test",
    )
    db_session.add(account)
    await db_session.commit()
    account_id = account.id

    # Raw DB read — should show encrypted prefix, NOT the plaintext
    raw = await db_session.execute(
        text("SELECT plaid_access_token FROM accounts WHERE id = :id").bindparams(id=account_id)
    )
    raw_value = raw.scalar_one()
    assert raw_value.startswith(_ENC_PREFIX)
    assert secret_token not in raw_value

    # ORM read — decrypts transparently
    db_session.expire_all()
    fetched = (
        await db_session.execute(select(Account).where(Account.id == account_id))
    ).scalar_one()
    assert fetched.plaid_access_token == secret_token


async def test_encrypted_string_handles_existing_unencrypted_data(db_session):
    """A row inserted with plaintext (legacy data) should be readable via ORM."""
    import uuid
    from sqlalchemy import select, text
    from app.models import Account, User

    user = User(
        email="legacy-token@example.com",
        hashed_password="bcrypt-hash",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    legacy_id = uuid.uuid4()
    # Bypass the ORM to write plaintext directly, simulating pre-encryption data
    await db_session.execute(
        text(
            "INSERT INTO accounts (id, user_id, plaid_access_token, plaid_item_id, institution_name, created_at) "
            "VALUES (:id, :uid, :tok, :item, :inst, NOW())"
        ).bindparams(
            id=legacy_id,
            uid=user.id,
            tok="plaintext-legacy-token",
            item="item-legacy",
            inst="Legacy Bank",
        )
    )
    await db_session.commit()

    fetched = (
        await db_session.execute(select(Account).where(Account.id == legacy_id))
    ).scalar_one()
    # The decryptor sees no enc1: prefix and returns the value untouched
    assert fetched.plaid_access_token == "plaintext-legacy-token"
