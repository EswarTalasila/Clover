import json
import os
import re
from datetime import date

import anthropic

client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODEL = "claude-haiku-4-5-20251001"

CATEGORIES = [
    "Food & Dining",
    "Shopping",
    "Transportation",
    "Entertainment",
    "Bills & Utilities",
    "Health",
    "Travel",
    "Income",
    "Other",
]


def _extract_json(text: str):
    """Best-effort JSON parse from a model reply (tolerates ```json fences / stray prose)."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"[\[{].*[\]}]", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
    return None


async def categorize_transaction(description: str, amount: float) -> str:
    prompt = (
        f"Categorize this bank transaction into exactly one of these categories: {', '.join(CATEGORIES)}.\n"
        f"Transaction: {description} (amount: ${amount})\n"
        f"Reply with only the category name, nothing else."
    )
    message = await client.messages.create(
        model=MODEL,
        max_tokens=20,
        messages=[{"role": "user", "content": prompt}],
    )
    category = message.content[0].text.strip()
    return category if category in CATEGORIES else "Other"


async def suggest_goal_contributions(goals: list[dict], transactions: list[dict]) -> list[dict]:
    """Map savings/transfer transactions to the goal each most likely funds.

    `goals`: [{id, name, note}], `transactions`: [{id, description, merchant_name, amount}].
    Returns [{transaction_id, goal_id, reason}] for confident matches only.
    """
    if not goals or not transactions:
        return []

    prompt = (
        "You match savings or transfer transactions to the personal savings goal they most "
        "likely fund. Only include a transaction when it clearly maps to one specific goal "
        "(e.g. a transfer named for a destination, a brokerage/savings deposit for an emergency "
        "fund, a card payment for a debt-payoff goal). Ignore everyday spending.\n\n"
        f"GOALS (JSON): {json.dumps(goals)}\n"
        f"TRANSACTIONS (JSON): {json.dumps(transactions)}\n\n"
        "Return ONLY a JSON array. Each item: "
        '{"transaction_id": "...", "goal_id": "...", "reason": "<= 8 words"}. '
        "Return [] if nothing is a confident match."
    )
    try:
        message = await client.messages.create(
            model=MODEL,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        data = _extract_json(message.content[0].text)
    except Exception:
        return []

    if not isinstance(data, list):
        return []

    goal_ids = {g["id"] for g in goals}
    tx_ids = {t["id"] for t in transactions}
    out = []
    for item in data:
        if not isinstance(item, dict):
            continue
        tid, gid = str(item.get("transaction_id", "")), str(item.get("goal_id", ""))
        if tid in tx_ids and gid in goal_ids:
            out.append({"transaction_id": tid, "goal_id": gid, "reason": str(item.get("reason", ""))[:120]})
    return out


async def parse_search_query(query: str) -> dict:
    """Turn a natural-language transaction query into structured filters.

    Returns keys: text, category, min_amount, max_amount, start_date, end_date, interpretation.
    Missing/unsure fields come back as null. Defensive: returns a text-only fallback on failure.
    """
    today = date.today().isoformat()
    prompt = (
        "Convert a personal-finance transaction search request into JSON filters.\n"
        f"Today is {today}. Categories: {', '.join(CATEGORIES)}.\n"
        "Fields (use null when not specified): "
        '"text" (keyword/merchant string), "category" (exact match from the list), '
        '"min_amount" (number), "max_amount" (number), '
        '"start_date"/"end_date" (YYYY-MM-DD), and "interpretation" '
        "(a short human phrase describing the filter, e.g. 'Food & Dining over $20 in May').\n"
        f'Request: "{query}"\n'
        "Return ONLY the JSON object."
    )
    try:
        message = await client.messages.create(
            model=MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        data = _extract_json(message.content[0].text)
    except Exception:
        data = None

    if not isinstance(data, dict):
        return {"text": query, "interpretation": f'Results for "{query}"'}
    return data
