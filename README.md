# Me.Compass — Personal Action Manager

A local, single-user tool that aggregates actions owed to the user from
Gmail, Google Drive/Gemini meeting notes, and Google Chat (plus manual
entry), flags what's overdue, and uses the local Claude Code CLI to infer
missing due dates/priority and suggest a next step per action.

Decisions: `docs/adr/` and `CHANGELOG.md` — read before proposing
architecture changes.

## Layout

- `backend/` — NestJS (Fastify adapter), `node:sqlite`
- `frontend/` — React + Vite
- `specs/001-personal-action-manager/` — spec, plan, tasks, data model, API
  contract, architecture diagram
- `docs/adr/` — architecture decision records
- `.specify/memory/constitution.md` — project principles

## Running it

See `specs/001-personal-action-manager/quickstart.md`. Needs a Google OAuth
client id/secret (`.env`, see `.env.example`) and `docker compose up --build`.
