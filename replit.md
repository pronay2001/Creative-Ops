# CreativeOps - Hoichoi Creative Operations Management

## Overview
Internal creative operations management tool for Hoichoi (hoichoi.tv). Tracks creative requests, campaigns, team workload, and asset delivery pipelines.

## Architecture
Full-stack application: Express.js backend + PostgreSQL database + vanilla JS frontend.

### Tech Stack
- **Backend**: Node.js + Express.js (CommonJS, no build step)
- **Database**: PostgreSQL (Replit built-in, accessed via `pg` package)
- **Frontend**: Vanilla JavaScript, HTML, CSS (no framework)
- **Libraries**: Lucide icons (CDN), Chart.js (CDN), SortableJS (CDN)
- **Session**: express-session with memory store

### File Structure
```
server.js                  # Express server with all API routes
db/
  migrate.js               # Database schema (auto-runs on boot)
  seed.js                  # Database seeding script
services/
  keka.js                  # Keka HR API client (employee sync)
  email.js                 # Microsoft Graph API email client
  email-templates.js       # HTML email templates
public/
  index.html               # App shell (unchanged)
  app.js                   # All UI logic (unchanged, ~3400 lines)
  style.css                # All styles (unchanged, ~4200 lines)
  data-service.js          # Data layer (unchanged, ~590 lines)
  seed-data.js             # Static config (platforms, asset types, depts, verticals)
  storage-client.js        # API client (rewritten from localStorage to fetch)
.env.example               # Required environment variables
```

### Data Flow
1. Frontend loads → `storage-client.js` calls `GET /api/load-all`
2. API returns users, campaigns, requests, etc. from PostgreSQL
3. `storage-client.js` transforms DB rows to frontend format, populates window globals
4. `data-service.js` operates on window globals, enriches with computed fields
5. `app.js` renders UI from DataService methods
6. Mutations (create, update) → `storage-client.js` → `fetch('/api/...')` → PostgreSQL

### Key Constraints
- **DO NOT modify**: app.js, style.css, data-service.js, index.html
- **storage-client.js** must keep same public API (method names, signatures, return shapes)
- Static config (platforms, verticals, departments, asset types) comes from seed-data.js (browser-side)
- Dynamic data (users, campaigns, requests) comes from PostgreSQL via API

### External Integrations
- **Keka HR**: Employee sync via OAuth 2.0 (`POST /api/keka/sync`). Requires KEKA_* env vars.
- **Microsoft Graph**: Email notifications via OAuth 2.0 client credentials. Requires AZURE_* env vars.
- Both integrations fail gracefully when credentials are not configured.

### Environment Variables
See `.env.example` for full list. Key ones:
- `DATABASE_URL` - PostgreSQL connection (auto-set by Replit)
- `SESSION_SECRET` - Express session secret
- `KEKA_COMPANY`, `KEKA_CLIENT_ID`, `KEKA_CLIENT_SECRET`, `KEKA_API_KEY` - Keka HR
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `MAIL_FROM` - Email

### Database
PostgreSQL with tables: users, campaigns, requests, deliverables, comments, activity_log, timesheet_entries, knowledge_entries, content_schedule. Schema auto-migrates on server start.

### Port
App runs on port 5000 (required for Replit webview).
