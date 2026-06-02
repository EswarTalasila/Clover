import logging
import os

import httpx

logger = logging.getLogger("clover.mailer")


async def send_email(to: str, subject: str, body: str) -> None:
    """Deliver an email via the configured provider, or log it to the console in dev.

    Set EMAIL_PROVIDER=resend with RESEND_API_KEY and EMAIL_FROM to send for real.
    With nothing configured (local dev), the message is printed so the whole flow is
    testable without an email service.
    """
    provider = os.getenv("EMAIL_PROVIDER", "").strip().lower()

    if provider == "resend":
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {os.getenv('RESEND_API_KEY', '')}"},
                    json={
                        "from": os.getenv("EMAIL_FROM", ""),
                        "to": [to],
                        "subject": subject,
                        "text": body,
                    },
                )
                resp.raise_for_status()
            return
        except Exception:
            logger.exception("Resend send failed for %s; falling back to console", to)

    # Dev fallback: make the message easy to spot and copy from the server log.
    logger.warning("[email:console] to=%s subject=%s", to, subject)
    print(
        "\n" + "=" * 64 + f"\n[DEV EMAIL]  To: {to}\n             Subject: {subject}\n\n{body}\n" + "=" * 64 + "\n",
        flush=True,
    )
