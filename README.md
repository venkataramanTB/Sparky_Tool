# Sparky_Tool

## Backend setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `DATABASE_URL` to a valid Neon/Postgres connection string:
   `postgresql+psycopg://user:pass@host:5432/database`
   - If your Neon connection string starts with `postgres://`, the backend will convert it automatically when `psycopg` is installed.
3. Install backend dependencies:
   `python -m pip install -r backend/requirements.txt`
4. Create database tables:
   `python backend/create_tables.py`

> Note: Neon provides a standard Postgres SQL connection string, not a REST endpoint.
