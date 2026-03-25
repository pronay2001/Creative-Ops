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

### Design System (Hoichoi Brand)
- **Colors**: Primary #d20820 (Red), Secondary #6d0550 (Velvet), Gradient linear-gradient(-60deg, #d20820, #6d0550)
- **Fonts**: Outfit (headings, 700-800, tracking -0.02em), Manrope (body), PT Mono (monospace/data)
- **Radii**: sm=6px, md=10px, lg=16px, xl=24px (pillow shape)
- **Dark surfaces**: #0d0d0d / #191919 / #222222 / #2a2a2a / #333333
- **Theme**: Dark by default (data-theme="dark"), light mode and prefers-color-scheme supported

### Authentication & Permissions
- **Login**: Email + password, domain-restricted (@hoichoi.tv / @svf.in). Passwords hashed with bcryptjs.
- **Session**: express-session with memory store, cookie-based. `requireAuth` middleware on all `/api/*` except `/api/auth/*`.
- **Roles**: `creative_lead`, `designer`, `approver`, `requester`
- **Permission matrix**:
  - Create requests/campaigns: requester, creative_lead, approver
  - Assign requests: creative_lead only
  - Advance status/approve: creative_lead, approver (+ assigned designer for own work)
  - Import/reset data: creative_lead only
  - Timesheet user switcher: creative_lead only (others see own timesheet)
- **Frontend**: `window.__currentUser` + `window.Permissions` object (built in index.html). UI buttons/actions hidden based on role.
- **Seed users**: 8 users seeded in db/migrate.js with bcrypt-hashed passwords (Pronay Roy=lead, Sneha/Arjun/Riya=designers, Anirban/Priyanka=approvers, Mitali/Sourav=requesters)
- **Password pattern**: INITIALS@HOICHOI for hoichoi.tv users, INITIALS@SVF for svf.in users

### Key Constraints
- **DO NOT modify**: data-service.js; app.js and index.html only for explicit auth/permission work
- **style.css, index.html**: Updated for Hoichoi brand design system; avoid further changes unless explicitly requested
- **storage-client.js** must keep same public API (method names, signatures, return shapes)
- Static config (platforms, verticals, departments, asset types) comes from seed-data.js (browser-side)
- Dynamic data (users, campaigns, requests) comes from PostgreSQL via API

### External Integrations
- **CSV Employee Import**: Upload HR CSV via `POST /api/users/import-csv` (multer + csv-parse). Auto-detects column headers, infers roles from designation, upserts by email. Lead-only.
- **Microsoft Graph**: Email notifications via OAuth 2.0 client credentials. Requires AZURE_* env vars.
- Integrations fail gracefully when credentials are not configured.

### Environment Variables
See `.env.example` for full list. Key ones:
- `DATABASE_URL` - PostgreSQL connection (auto-set by Replit)
- `SESSION_SECRET` - Express session secret
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `MAIL_FROM` - Email

### Database
PostgreSQL with tables: users, campaigns, requests, deliverables, comments, activity_log, timesheet_entries, timesheet_clock, knowledge_entries, content_schedule. Schema auto-migrates on server start.
- `requests.vertical` TEXT column stores vertical (hoichoi, SVF, etc.)
- `timesheet_clock` tracks clock-in/clock-out entries with start/end times, duration, auto-sync to timesheet_entries
- Asset type ID migration in migrate.js maps old IDs to new taxonomy (e.g. repurpose_reel→scene_cutdown)

### Port
App runs on port 5000 (required for Replit webview).
