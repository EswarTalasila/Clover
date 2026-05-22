.PHONY: install db db-stop migrate migrate-new backend frontend dev

install:
	uv pip install -r backend/requirements.txt
	cd frontend && npm install

db:
	docker compose up -d

db-stop:
	docker compose down

migrate:
	cd backend && ../.venv/bin/alembic upgrade head

migrate-new:
	cd backend && ../.venv/bin/alembic revision --autogenerate -m "$(name)"

backend:
	cd backend && ../.venv/bin/python run.py

frontend:
	cd frontend && npm run dev

dev:
	make db
	@echo "Starting backend and frontend..."
	cd backend && ../.venv/bin/python run.py & cd frontend && npm run dev
