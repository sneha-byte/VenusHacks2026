# Browzen

EasyWeb is an accessibility-first web assistant for simplifying confusing websites and forms. The app combines a React frontend, a FastAPI backend, Redis-backed session state, and a browser-use agent that can inspect or interact with real websites.

Built for Venus Hacks 2026.

## What It Does

- Lets users chat with an assistant about a website or form they need help with.
- Uses browser-use to navigate, inspect, and act on websites.
- Converts complex website state into simplified UI models:
  - forms
  - markdown explanations
  - result lists
  - conversation blocks
  - confirmations
- Stores user/session state in Redis.
- Supports accessibility preferences such as high contrast, dyslexia-friendly fonts, text scaling, and voice-oriented interaction.
- `backend/` — FastAPI + browser-use agent, sessions, sandbox
- `frontend/` — Browzen React web app (onboarding, chat, simplified UI, sandbox preview)

## Web frontend (Browzen)

## Project Structure

```text
.
|-- backend/                  FastAPI backend, Redis services, browser-use agent
|   |-- app.py                FastAPI app setup and router registration
|   |-- common/               Environment constants and shared config
|   |-- models/               Pydantic request/response models
|   |-- routes/               API routes for sessions and agent chat
|   `-- services/             Redis, session, and browser-use services
|
|-- frontend/                 React + Vite frontend
|   |-- src/api/              Frontend API client
|   |-- src/components/       Chat, browser, accessibility, layout components
|   |-- src/context/          Session and accessibility state providers
|   |-- src/pages/            Chat and onboarding pages
|   `-- public/               Static assets
|
`-- README.md                 This file
```

Note: the current app lives in `frontend/`. If you see older top-level frontend files, treat `frontend/` as the active app.

## Backend

The backend is a FastAPI application that owns:

- user sessions
- chat/browser sessions
- Redis persistence
- browser-use agent orchestration
- Pydantic models shared across routes/services

### Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
uvicorn app:app --reload --port 8000
```

### Backend Environment

Create `backend/.env`:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
ALLOWED_ORIGINS=http://localhost:5173

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

If Redis does not require a password, leave `REDIS_PASSWORD` empty.

### Redis

The backend expects Redis to be running locally unless configured otherwise.

Example using Docker:

```powershell
docker run --name easyweb-redis -p 6379:6379 redis:latest
```

Redis is used for:

- `UserState`
- chat session ids
- per-session UI messages/states

## Frontend

The frontend is a React + Vite app.

### Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

### Frontend Environment

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

## API Overview

### Health

```http
GET /health
```

Returns:

```json
{ "status": "ok" }
```

### Session Routes

Session routes live in `backend/routes/sessions.py`.

Current routes include:

```text
GET    /session/
POST   /session/create-user-session
POST   /session/update-user-session
DELETE /session/delete-user-session
GET    /session/message-sessions
POST   /session/create-message-session
DELETE /session/delete-message-session
POST   /session/update-message-session
```

These routes manage user sessions, browser/chat sessions, and stored UI state.

### Agent Routes

`backend/routes/agent.py` defines:

```http
POST /agent/chat          { "query": "...", "session_id": "<chat session id>" }
POST /agent/submit-form   { "session_id": "...", "form_reference_id": "<form UI id>" }
```

`/agent/chat`:

1. saves the user message and loads the chat history from Redis
2. classifies the query into a `ParsedIntent` (website / form / app / invalid)
3. form updates are merged into the stored simplified form; website requests run the
   browser-use agent inside that chat's own Playwright context
4. stores the returned UI state and returns a `ChatResponse`

Both routes publish live progress to the session's WebSocket (below).

### Live WebSocket

```text
WS /sandbox/ws/{chat_session_id}[?frames=false]
```

- **Binary messages:** JPEG frames of the session's active page, sent only when the frame changes (~2 fps max).
- **Text messages:** JSON agent events: `agent_started`, `intent`, `agent_step` (step number, goal, actions), `agent_done`, `agent_error`.
- **On connect:** the server first sends `{"type": "replay", "events": [...]}` with the last 50 events from Redis, so a client that reconnects mid-run catches up.
- **Client controls:** `{"type": "pause"}` / `{"type": "resume"}` stop and restart frames.
- **Events only:** `?frames=false` skips screenshots. The chat's progress strip uses this.

The frontend falls back to polling `GET /sandbox/stream/{id}` if the socket can't connect.

## Core Models

Models live in:

```text
backend/models/request_models.py
backend/models/response_models.py
```

### Request Models

- `UserQuery`: raw user text.
- `AgentChatRequest`: request body for `/chat`; includes `query` and `sessionId`.
- `ParsedIntent`: the AI-classified intent.
- `UpdateUserStateRequest`: replace/update stored user state.
- `UpdateSessionStateRequest`: add/update UI state in a chat session.

### Response/UI Models

- `UserState`: top-level user session metadata.
- `ChatSessionState`: one chat/browser session and its UI states.
- `UIResponse`: union of all renderable UI states.
- `FormResponse`: simplified website form.
- `MarkdownResponse`: explanatory text.
- `ListResponse`: simplified list of results/options.
- `ConversationResponse`: conversation-style block.
- `ConfirmationResponse`: final action/submission confirmation.

## Browser-Use Flow

The browser-use logic lives in:

```text
backend/services/browser_use_service.py
backend/services/session_service.py
```

High-level flow:

1. A browser/chat session is created.
2. The frontend sends a user query.
3. `BrowserUseService.infer_user_intent()` classifies the query.
4. `BrowserUseService.perform_action()` uses the parsed intent.
5. browser-use interacts with the website.
6. The result is converted into a simplified `UIResponse`.
7. The UI response is stored in Redis and returned to the frontend.

## Run with Docker

```bash
DEEPSEEK_API_KEY=your_key docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000

The compose file runs three containers:

- **Redis**, with a volume so data persists.
- **The backend**, with Chromium installed through the pinned Playwright version and 1 GB of shared memory for the browser.
- **The frontend**, built with Vite and served by nginx.

## Memory Benchmark

`backend/benchmarks/memory_benchmark.py` compares two designs for N concurrent users:

- **separate:** one browser per user.
- **shared:** one Chromium with an isolated context per user, which is what `SessionService` does.

```bash
cd backend
python benchmarks/memory_benchmark.py --users 10 --runs 3
python benchmarks/memory_benchmark.py --url https://www.dmv.ca.gov/portal/
```

Results on Linux (PSS, median of 3 runs, built-in 60-section test form):

| Users | Separate browsers | Shared + contexts | Reduction |
|---|---|---|---|
| 5 | 920 MB | 553 MB | 40% |
| 10 | 1561 MB | 789 MB | 49% |

The savings grow with the number of users, because every extra browser repeats the
browser process, GPU process and network service, while an extra context only adds a renderer.

## Notes

- `browser-use` is pinned to 0.5.11. Version 0.6 and later drive Chrome over CDP and ignore a
  Playwright `BrowserContext`, so the agent would launch its own browser outside the user's session.
- `playwright install chromium` is required after installing backend dependencies (the Docker image does this).
- Without Redis the backend falls back to an in-memory store (fine for local dev, lost on restart).

## Useful Commands

Run frontend:

```powershell
cd frontend
npm run dev
```

Build frontend:

```powershell
cd frontend
npm run build
```

Run backend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app:app --reload --port 8000
```

Check backend health:

```powershell
curl http://localhost:8000/health
```

## Design System

Primary palette:

| Name | Hex |
| ---- | --- |
| Jet Black | `#2c363f` |
| Blush Rose | `#e75a7c` |
| Ivory | `#f2f5ea` |
| Dust Grey | `#d6dbd2` |
| Dry Sage | `#bbc7a4` |

Fonts:

- Lexend: default UI font
- OpenDyslexic: dyslexia-friendly mode

## Troubleshooting

### Backend cannot import Playwright

Run:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
```

### Browser-use tries to write to a global config directory

The project ignores `backend/.browseruse`, which is where browser-use local profile/config files should live.

### Frontend cannot reach backend

Check:

- backend is running on `http://localhost:8000`
- `frontend/.env` has `VITE_API_URL=http://localhost:8000`
- `ALLOWED_ORIGINS` in `backend/.env` includes `http://localhost:5173`

### Redis errors

Make sure Redis is running and `.env` has the correct host/port/password.
