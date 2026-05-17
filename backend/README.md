# Browzen Backend

FastAPI backend for Browzen. The backend defines the shared request/response
models, stores user and chat session state in Redis, and will host the browser
agent orchestration layer.

## Run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Environment

Create `backend/.env` with:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
ALLOWED_ORIGINS=http://localhost:5173

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## State Models

`models/response_models.py` contains the persisted UI/session state:

- `UserState`: user-level state, onboarding, accessibility options, and chat sessions.
- `ChatSessionState`: one chat session with a list of UI states.
- `UIResponse`: union of form, markdown, list, conversation, and confirmation responses.
- `AccessibilityOptions`: user accessibility preferences.

`models/request_models.py` contains request payloads for user queries, parsed
intent, and state updates.

## Redis

`services/redis_service.py` stores Pydantic models as JSON and restores them with
Pydantic validation so nested UI response types are preserved.

Keys:

- `user:<user_id>` stores a `UserState`.
- `chat_session:<session_id>` stores a `ChatSessionState`.

Both use `SESSION_EXPIRATION` from `common/constants.py`.

## Current Endpoints

- `GET /health`: backend health check.
- `/session/*`: session routes exist, but most route handlers are still placeholders.

The older `/analyze` endpoint described in previous docs no longer exists.
