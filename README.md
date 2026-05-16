# EasyWeb Assistant

Accessible React frontend for simplifying government and medical websites. Built for Venus Hacks 2026.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

**Flow:** Onboarding → **Start a new session** → chat with a **left sidebar** of past sessions. Form preview and website preview only appear after your backend agent returns data (no hardcoded demo content).

## Color palette

| Name | Hex |
|------|-----|
| Vintage Grape | `#413c58` |
| Ash Grey | `#a3c4bc` |
| Tea Green | `#bfd7b5` |
| Cream | `#e7efc5` |
| Vanilla Custard | `#f2dda4` |

## Fonts

- **Default:** [Lexend](https://fonts.google.com/specimen/Lexend) — designed for readability and low visual stress
- **Dyslexia mode:** [OpenDyslexic](https://opendyslexic.org/) — toggle in onboarding or the accessibility bar

## Backend integration

Set `VITE_API_URL` in `.env` (see `.env.example`).

| Endpoint | Purpose |
|----------|---------|
| `POST /chat` | User query → agent response + simplified UI JSON |
| `POST /sandbox/event` | Mirror clicks/inputs to sandboxed browser |
| `GET /sandbox/stream/:id` | Live browser stream URL for the preview iframe |

The UI expects a running API; chat shows an error if the backend is unreachable.

## Project structure

```
src/
  pages/           Onboarding + chat layout
  components/      Chat, simplified form, sandbox preview
  context/         Accessibility profile + session state
  hooks/           Voice control, sandbox events
  api/             Backend client stubs
```
