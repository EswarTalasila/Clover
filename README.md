# Clover

[![CI](https://github.com/EswarTalasila/budgeting-app/actions/workflows/ci.yml/badge.svg)](https://github.com/EswarTalasila/budgeting-app/actions/workflows/ci.yml)

A personal budgeting app that connects to your bank, categorizes your transactions with AI, and shows you where your money actually goes. Built as a self-hosted alternative to Mint after Intuit shut it down.

Connects to your bank via [Plaid](https://plaid.com), auto-categorizes via [Claude](https://www.anthropic.com/claude), and keeps everything on a database you control.

## Features

- **Bank connections via Plaid** — connect any supported US bank, automatic incremental sync via cursor-based pagination
- **AI categorization** — Claude (Haiku 4.5) auto-categorizes any transactions Plaid can't classify confidently, plus all manual entries
- **Budgets** — set monthly limits per category, see spent / remaining / over-budget at a glance
- **Visualizations** — donut chart of category spending, 6-month spending trend, interactive selection
- **Subscriptions** — Plaid-detected recurring charges with monthly-equivalent totals
- **Transaction metadata** — merchant, location, payment channel, source bank, status, free-form notes
- **Excluded transactions** — hide one-off items (transfers, refunds) from budget calculations without losing the record
- **iOS app** — same React frontend wrapped in a real native iOS shell via Capacitor
- **Dark mode** — system-aware, manual toggle in settings
- **Responsive** — drawer sidebar on mobile, full sidebar on desktop
- **Self-hosted** — your transactions stay in your Postgres, on your machine

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind + Recharts + React Router |
| Backend | FastAPI (async Python), SQLAlchemy 2 async, Alembic |
| Database | PostgreSQL 15 (in Docker for local dev) |
| Bank data | Plaid (sandbox or production) |
| AI categorization | Anthropic SDK (`claude-haiku-4-5`) |
| Auth | JWT (HS256) + bcrypt |
| iOS | Capacitor 7 wrapping the React app |
| Tests | pytest with 32 passing tests, real Postgres |
| Task runner | [Taskfile](https://taskfile.dev) |
| CI | GitHub Actions (backend tests + frontend build) |

## Quick start

### Prerequisites

- Docker (for Postgres)
- Python 3.11+, [uv](https://docs.astral.sh/uv/) (for backend deps)
- Node 20+
- [Task](https://taskfile.dev) (`brew install go-task`)
- Plaid sandbox credentials (free at [dashboard.plaid.com](https://dashboard.plaid.com))
- Anthropic API key

### Setup

```bash
git clone https://github.com/EswarTalasila/budgeting-app.git
cd budgeting-app

# Python venv + install
uv venv
source .venv/bin/activate
uv pip install -r backend/requirements.txt

# Frontend deps
cd frontend && npm install && cd ..

# Configure secrets
cp backend/.env.example backend/.env
# Edit backend/.env and add:
#   JWT_SECRET=  (run: python3 -c "import secrets; print(secrets.token_urlsafe(48))")
#   PLAID_CLIENT_ID=
#   PLAID_SECRET=
#   PLAID_ENV=sandbox
#   ANTHROPIC_API_KEY=

# Start Postgres, run migrations, start backend + frontend
task dev
```

App runs at:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000 (API docs at /docs)

Stop everything with `task stop`.

### Useful task commands

| Command | What it does |
|---|---|
| `task dev` | Start DB, migrate, run backend + frontend |
| `task stop` | Stop backend, frontend, and Postgres |
| `task test` | Run backend test suite |
| `task migrate` | Apply pending DB migrations |
| `task migrate:new -- "name"` | Generate a new migration from model changes |

## Architecture

```
┌──────────────┐     JWT     ┌─────────────┐
│  React SPA   │ ──────────► │   FastAPI   │
│  (Vite)      │ ◄────────── │   (async)   │
└──────────────┘             └──────┬──────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
      │  PostgreSQL  │     │    Plaid     │     │  Anthropic   │
      │  (Docker)    │     │    API       │     │  (Claude)    │
      └──────────────┘     └──────────────┘     └──────────────┘
```

### Data model

- **User** — email, bcrypt hashed password
- **Account** — bank connection (Plaid access token, cursor for incremental sync, institution name)
- **Transaction** — amount, date, description, merchant, category, AI/Plaid-derived metadata, manual/synced flag, excluded flag
- **Budget** — category + month + monthly limit, unique per `(user, category, month)`

### Plaid sync flow

1. Browser asks backend for a Plaid Link token
2. Browser opens Plaid Link, user authorizes their bank
3. Browser sends `public_token` back to backend
4. Backend exchanges it for a long-lived `access_token`, stores it on the Account
5. Backend pages through `transactions/sync` using a cursor, persisted per account, so subsequent syncs only fetch new/changed/removed transactions
6. For each new transaction, Plaid's `personal_finance_category` is mapped to one of 9 internal categories; if Plaid returns "Other" or null, Claude is called as a fallback
7. Recurring detection runs separately via Plaid's `transactions/recurring/get`

## Project structure

```
budgeting-app/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + CORS + routes
│   │   ├── database.py          # SQLAlchemy async engine + get_db
│   │   ├── models.py            # ORM models
│   │   ├── schemas.py           # Pydantic v2 request/response models
│   │   ├── middleware/auth.py   # JWT bearer auth dependency
│   │   ├── routes/              # auth, transactions, budgets, plaid
│   │   └── lib/                 # Plaid client, Claude client
│   ├── alembic/                 # DB migrations
│   ├── tests/                   # pytest suite (32 tests)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/               # Dashboard, Transactions, Budgets, Subscriptions, Accounts, Settings, Login
│   │   ├── components/          # Layout, CategoryDonut, MonthlyTrend, ConfirmDialog, Toast, etc.
│   │   ├── context/             # AuthContext, ThemeContext
│   │   ├── hooks/               # useTransactions
│   │   └── lib/api.js           # axios client
│   ├── ios/                     # Capacitor-generated Xcode project
│   ├── capacitor.config.ts
│   └── package.json
├── docker-compose.yml           # Postgres 15 + pgAdmin
├── Taskfile.yml                 # Task runner commands
└── .github/workflows/ci.yml     # CI: backend tests + frontend build
```

## Tests

```bash
task test
```

Backend test suite covers auth flows, transaction CRUD, budget upserts + summary math, trend aggregation, Plaid endpoint contracts, and authorization on every protected route. Plaid + Claude calls are mocked at the SDK boundary; DB is a real Postgres `budgeting_test` database, truncated between tests for isolation.

## Running on a phone

The frontend is also a Capacitor iOS app:

```bash
cd frontend
npx cap sync ios
npx cap open ios
```

Then build & run from Xcode. The iOS app connects to the same backend over the network (we use [Tailscale](https://tailscale.com) so the phone can reach the Mac's `localhost`).

## Security notes for self-hosted use

- Plaid access tokens are stored unencrypted at rest. For local single-user use this is reasonable (the tokens are read-only and your laptop is the trust boundary); for a multi-tenant deployment, encrypt them.
- Plaid tokens can only **read** transactions and balances. They cannot move money, change account info, or expose your bank password (Plaid never sees the password).
- CORS is wide open (`allow_origins=["*"]`) for local dev. Tighten before exposing the backend publicly.
- The JWT secret defaults to `change_me` in `.env.example`. **Always change it before using the app for real data.**

## Roadmap

Things that aren't built yet but are within scope:

- Plaid Liabilities (auto-sync student loan / credit card balances)
- CSV import (for banks Plaid doesn't support)
- Multi-currency support
- AWS deployment (Dockerfile + GitHub Actions OIDC, ready to wire up)

## License

Personal project, all rights reserved. Use the code as inspiration, don't redistribute as your own product.
