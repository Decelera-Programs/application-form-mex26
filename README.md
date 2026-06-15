# decelera typebot

Conversational application form for Decelera Ventures.
Built with React + Node.js/Express + PostgreSQL, deployable on Railway.

## Architecture

```
frontend/          React chat UI (Vite)
backend/           Node.js API (Express + TypeScript)
  src/
    db/            PostgreSQL pool + migration
    routes/        REST API endpoints
    services/
      sessionService.ts   DB operations
      attioService.ts     Attio sync (people + companies)
      retryWorker.ts      Background retry for failed syncs
      flowEngine.ts       Conditional step resolution
shared/
  types.ts         TypeScript interfaces shared by both
  flow-config.json The actual questions + flow logic
```

## Data flow

1. Founder opens the form → session created in PostgreSQL
2. Each answer is saved immediately to `answer_log` (raw event log) and merged into `application_sessions.answers`
3. On completion → Attio sync attempted immediately (best-effort)
4. If Attio sync fails → marked `synced_to_attio = false`
5. Retry worker runs every 60s → retries all unsynced completed sessions

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example backend/.env
# Fill in DATABASE_URL and ATTIO_API_KEY

# 3. Run database migration
cd backend && npm run db:migrate

# 4. Start both frontend + backend
cd .. && npm run dev
```

Frontend: http://localhost:5173
Backend:  http://localhost:3001

## Deploy to Railway

1. Push this repo to GitHub
2. Create a new Railway project → "Deploy from GitHub repo"
3. Add a PostgreSQL plugin to the project
4. Set environment variables in Railway dashboard:
   - `DATABASE_URL` → auto-set by Railway's Postgres plugin
   - `ATTIO_API_KEY` → your Attio API key
   - `ALLOWED_ORIGINS` → `https://decelera.vc,https://www.decelera.vc`
   - `NODE_ENV` → `production`
5. After first deploy, run the migration:
   ```
   railway run npm run db:migrate --workspace=backend
   ```
6. Done. Railway will auto-deploy on every push to main.

## Embedding on decelera.vc

The simplest and most robust embed is an iframe:

```html
<!-- Paste this wherever you want the form to appear -->
<iframe
  src="https://your-railway-url.up.railway.app"
  style="width: 100%; height: 700px; border: none; border-radius: 16px;"
  title="Apply to Decelera"
  allow="clipboard-write"
></iframe>
```

For full-page embed (recommended for mobile):

```html
<iframe
  src="https://your-railway-url.up.railway.app"
  style="position: fixed; inset: 0; width: 100%; height: 100%; border: none; z-index: 9999;"
  title="Apply to Decelera"
></iframe>
```

## Editing the questions

All questions, options, and branching logic live in `shared/flow-config.json`.
No code changes needed — just edit the JSON and redeploy.

### Adding a new question

```json
"new_question_id": {
  "id": "new_question_id",
  "type": "text",
  "question": "What's your question?",
  "required": true,
  "nextStep": "next_step_id",
  "attioField": "attio_field_slug",
  "attioObject": "people"
}
```

### Supported field types
- `text` — single line
- `textarea` — multi-line
- `email` — email validation
- `url` — URL input
- `number` — numeric
- `select` — single choice (renders as tappable buttons)
- `multiselect` — multiple choice
- `boolean` — Yes / No
- `statement` — bot message only, no input (use for transitions)

### Conditional branching

```json
"conditions": [
  {
    "if": { "fieldId": "startup_sector", "operator": "equals", "value": "Other" },
    "then": "startup_sector_other"
  }
]
```

Operators: `equals`, `not_equals`, `contains`, `not_contains`, `exists`
