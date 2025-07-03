# Member Portal – Phase 1 Foundation

This directory contains the minimal scaffolding for the new public-facing member portal.
It consists of:

* `backend/` – NestJS + Prisma API server
* `frontend/` – Next.js (React) client
* `docker-compose.yml` – local development orchestration (PostgreSQL + apps)

## Quick start (development)

```bash
# Inside the repository root
cd member-portal
# start Postgres
docker-compose up -d db

# ---- Backend ----
cd backend
# install deps
npm install
# or: yarn
# run first migration & generate client
npm run prisma:migrate
# start dev server
npm run start:dev

# ---- Frontend ----
cd ../frontend
npm install
npm run dev
```

### Environment
Set a `.env` in `backend` with at least:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/member_portal
```

> Phase&nbsp;1 is intentionally lightweight – just enough to get both servers booting and connected to the database.
> Subsequent phases will flesh out authentication, domain models, and UI.