## Byte Runner Backend

NestJS backend for authentication and the 24h leaderboard.

### Setup

1) Copy env file:

```bash
cp .env.example .env
```

2) Create Supabase tables:

```bash
# Run in Supabase SQL editor
supabase/schema.sql
```

3) Install deps:

```bash
npm install
```

4) Run locally:

```bash
npm run start:dev
```

### Auth (Supertokens)

This API uses Supertokens email/password.

- API base path: `/auth`
- Website base path: `/auth`

### API Endpoints

- `GET /` — health check
- `GET /users/me` — current user (requires session)
- `POST /users/username` — set unique username (requires session)
- `POST /runs/start` — get run token (requires session)
- `POST /runs/finish` — submit run (requires session)
- `GET /leaderboard/current?limit=50` — last 24h leaderboard

### Docker (optional)

```bash
docker compose up --build
```
