# ClearPath Backend

FastAPI backend for ClearPath. This service owns the DeepSeek API key, builds prompts, sanitizes CSS, validates selectors, and caches responses.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app:app --reload --port 8000
```

## Environment

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID,http://localhost:5173
```

## Endpoint

- `POST /analyze`: accepts a user question and structured page context, returns simple instructions, important selectors, and sanitized CSS.

The backend caches responses by `hostname + task` for 7 days. It does not cache personal form values or full page HTML.
