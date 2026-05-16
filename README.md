# ClearPath

ClearPath is a full-stack AI-powered Chrome Extension that helps people navigate confusing websites with simpler language, step-by-step guidance, reversible CSS simplification, and important element highlighting.

## What ClearPath Is For

ClearPath is designed for users with ADHD, cognitive disabilities, executive dysfunction, dyslexia, elderly users, and non-technical users who may struggle with DMV, insurance, healthcare, banking, and government websites.

## Architecture

```text
frontend/browser-extension
  public/
    manifest.json        Chrome MV3 config with Side Panel API
    background.js        Enables toolbar click to open the side panel
    content-script.js    Extracts page context and injects reversible CSS
  src/
    components/          Side panel UI pieces
    hooks/               Chat, page context, accessibility state
    services/            Backend API and Chrome messaging helpers
    types/               Shared TypeScript interfaces
    utils/               Small reusable helpers
    App.tsx              Main side panel app
    main.tsx             React entrypoint

backend
  app.py                 FastAPI app
  routes/analyze.py      POST /analyze
  services/              DeepSeek, cache, CSS sanitizer
  models/                Pydantic request/response models
  cache/                 Cache data model
  prompts/               AI system prompt
```

## Safety Rules

- AI only generates CSS and instructional text.
- AI never generates JavaScript.
- The extension never modifies website functionality.
- CSS simplification is reversible.
- The content script uses one managed style tag: `id="clearpath-style"`.
- The backend owns the DeepSeek API key.
- The frontend never sends full HTML, form values, or personal data.

## Backend Setup

```powershell
cd C:\VenusHacks2026\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env`:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID,http://localhost:5173
```

Run the backend:

```powershell
uvicorn app:app --reload --port 8000
```

Health check:

```powershell
curl http://localhost:8000/health
```

## Frontend Setup

```powershell
cd C:\VenusHacks2026\frontend\browser-extension
npm install
npm run build
```

Load the extension:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select `C:\VenusHacks2026\frontend\browser-extension\dist`.
5. Click the ClearPath toolbar icon to open the side panel.

## How The MVP Flow Works

1. The side panel asks the content script for page context.
2. The content script extracts structured data: URL, title, headings, buttons, forms, links, and short visible text.
3. The side panel sends the task and page context to `POST /analyze`.
4. The backend checks cache by `hostname + task`.
5. If not cached, the backend asks DeepSeek for simple instructions, important selectors, and CSS only.
6. The backend sanitizes CSS and validates selectors against the provided page context.
7. The side panel displays the answer and sends CSS/selectors to the content script.
8. The content script updates `#clearpath-style` and highlights important elements.
9. Reset removes the style tag and highlight classes.

## API

`POST /analyze`

Request:

```json
{
  "question": "How do I renew my license?",
  "pageContext": {
    "url": "https://example.gov",
    "hostname": "example.gov",
    "title": "Example Portal",
    "headings": ["Services"],
    "buttons": [{ "text": "Renew", "selector": "#renew" }],
    "forms": [],
    "links": [],
    "visibleText": "Short visible page text..."
  }
}
```

Response:

```json
{
  "summary": "This page helps you renew your license.",
  "steps": ["Choose Renew.", "Sign in.", "Follow the form."],
  "importantSelectors": ["#renew"],
  "css": "#renew { outline: 3px solid #f4c542; }",
  "cached": false
}
```
