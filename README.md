# ClearPath / EasyWeb

AI-powered accessibility tool for simplifying confusing websites (DMV, healthcare, government forms). Built for Venus Hacks 2026.

**Repo layout**

- `backend/` — FastAPI + browser-use agent, sessions, sandbox
- Root (`src/`, `package.json`) — EasyWeb React web app (onboarding, chat, simplified UI, sandbox preview)

## Web frontend (EasyWeb)

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Set `VITE_API_URL=http://localhost:8000` in `.env` (see `.env.example`).

| Endpoint | Purpose |
|----------|---------|
| `POST /chat` | User query → agent response + simplified UI JSON |
| `POST /sandbox/event` | Mirror user actions to sandboxed browser |
| `GET /sandbox/stream/:id` | Live browser stream for preview iframe |

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Design

| Name | Hex |
|------|-----|
| Vintage Grape | `#413c58` |
| Ash Grey | `#a3c4bc` |
| Tea Green | `#bfd7b5` |
| Cream | `#e7efc5` |
| Vanilla Custard | `#f2dda4` |

Fonts: **Lexend** (default), **OpenDyslexic** (dyslexia mode).
