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

### Agent Chat Route

`backend/routes/agent.py` defines:

```http
POST /chat
```

Request body:

```json
{
  "query": "Help me fill out this form",
  "sessionId": "00000000-0000-4000-8000-000000000000"
}
```

The route:

1. loads the current chat state from Redis
2. classifies the user query into a parsed intent
3. runs the browser-use service against the active browser session
4. stores the returned UI state
5. returns a `UIResponse`

Important: in the current `backend/app.py`, the agent router is commented out. To enable `/chat`, uncomment:

```python
from routes.agent import agent_router
app.include_router(agent_router)
```

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

## Current Integration Notes

- The backend `/chat` route currently returns the backend `UIResponse` model directly.
- The frontend API client currently expects a `ChatResponse` shape with fields like `message` and `simplifiedUi`.
- A small mapping layer may be needed so frontend and backend response shapes match.
- `playwright install chromium` is required after installing backend dependencies.
- Redis must be running for session persistence.

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
