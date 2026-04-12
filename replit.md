# CreativeOps - Hoichoi Creative Operations Management

## Overview
Internal creative operations management tool for Hoichoi (hoichoi.tv). Tracks creative requests, campaigns, workload, and asset delivery pipelines.

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
- **Login**: Email + password, domain-restricted (@hoichoi.tv / @svf.in). Passwords hashed with bcryptjs. Also supports Microsoft SSO via Azure AD OAuth 2.0 (authorization code flow).
- **Microsoft SSO**: `/api/auth/microsoft` initiates OAuth flow → Microsoft login → `/api/auth/microsoft/callback` exchanges code for token, fetches profile from Graph API, creates/finds user, sets session. Requires AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET secrets. Domain-restricted to @hoichoi.tv and @svf.in. Redirect URI is dynamically computed from request host. Both dev and production domains are supported automatically.
- **Registration**: Self-service sign-up at `/api/auth/register` for @hoichoi.tv and @svf.in emails. If email exists from CSV import (no password set), sets password on existing record preserving role/designation. New users get `requester` role. Password min 6 chars.
- **Session**: express-session with memory store, cookie-based. `requireAuth` middleware on all `/api/*` except `/api/auth/*`.
- **Roles**: `creative_lead`, `designer`, `approver`, `requester`
- **Hierarchy Levels**: `admin` (full control), `manager` (can approve/advance), `team` (default). Column `hierarchy_level` on users table. Admin-only endpoints: `PATCH /api/users/:id/hierarchy`, `PATCH /api/users/:id/role`.
- **Approval Workflow**: Requests have `approver_id` (mandatory). Final approver list is a fixed set of 10 specific people (defined in `FINAL_APPROVER_IDS` in app.js). `DataService.setRequestApprover()` and `DataService.updateRequestField()` for client-side state management.
- **Business Hours**: Requisitions can only be created Monday 9 AM to Friday 7 PM IST. Enforced on both frontend and backend.
- **Permission matrix**:
  - Create campaigns: admin only (hierarchy_level = 'admin')
  - Create requests: requester, creative_lead, approver (with mandatory team selection and Final Approver)
  - **Team assignment flow**: Requester selects a team (Graphics/Video/Motion Graphics). Email goes to team lead (Sagnik Ghosh / Arnab Bhattacharjee / Mangaldeep Karmakar). Team lead reassigns to a specific employee → assignee gets email, requester gets email, task shows on assignee's calendar & kanban.
  - Assign/reassign requests: current assignee (team lead), creative_lead, creator, or admin
  - Advance status/approve: creative_lead, approver, hierarchy admin/manager, designated approver (+ assigned designer for own work)
  - Import/reset data: creative_lead only
  - Change hierarchy/roles: hierarchy admin only
  - Timesheet user switcher: creative_lead only (others see own timesheet)
- **Frontend**: `window.__currentUser` + `window.Permissions` object (built in index.html). UI buttons/actions hidden based on role. Hierarchy badges shown in Team Directory. Approver selector in request create and detail panels.
- **Seed users**: 91 employees seeded in db/migrate.js from HR CSV data with `ON CONFLICT (email)` upserts. Pronay Roy bootstrapped as hierarchy admin via `hierarchyBootstrap` migration step.
- **Password pattern**: INITIALS@HOICHOI for hoichoi.tv users, INITIALS@SVF for svf.in users

### Key Constraints
- **DO NOT modify**: data-service.js; app.js and index.html only for explicit auth/permission work
- **style.css, index.html**: Updated for Hoichoi brand design system; avoid further changes unless explicitly requested
- **storage-client.js** must keep same public API (method names, signatures, return shapes)
- Static config (platforms, verticals, departments, asset types) comes from seed-data.js (browser-side)
- Dynamic data (users, campaigns, requests) comes from PostgreSQL via API

### External Integrations
- **CSV Employee Import**: Upload HR CSV via `POST /api/users/import-csv` (multer + csv-parse). Auto-detects column headers, infers roles from designation, upserts by email. Lead-only.
- **Microsoft Graph Email**: Notifications via OAuth 2.0 client credentials (`services/email.js`). Sends branded HTML emails (`services/email-templates.js`) on: task assignment (including at creation), status changes, new comments, approval decisions. Requires AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, MAIL_FROM env vars. Fails gracefully when not configured.
- **Calendar**: In-app monthly calendar with "My Tasks" / "All Tasks" toggle. Shows go-live dates and internal deadlines. Drag-and-drop rescheduling. Filters by assigned tasks, created tasks, and deliverables assigned to the logged-in user.

### Environment Variables
See `.env.example` for full list. Key ones:
- `DATABASE_URL` - PostgreSQL connection (auto-set by Replit)
- `SESSION_SECRET` - Express session secret
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `MAIL_FROM` - Email

### Database
PostgreSQL with tables: users, campaigns, requests, deliverables, comments, activity_log, timesheet_entries, timesheet_clock, knowledge_entries, content_schedule, asset_files. Schema auto-migrates on server start.
- `requests.vertical` TEXT column stores vertical (hoichoi, SVF, etc.)
- `timesheet_clock` tracks clock-in/clock-out entries with start/end times, duration, auto-sync to timesheet_entries
- Asset type ID migration in migrate.js maps old IDs to new taxonomy (e.g. repurpose_reel→scene_cutdown)
- `asset_files` stores uploaded asset files with version tracking, linked to requests. Files stored in `uploads/` directory on disk.

### Asset Management
- **Upload**: `POST /api/requests/:id/upload` — multer disk storage, 50MB limit. Only assigned users (top-level or deliverable), leads, or hierarchy admins can upload.
- **Download**: `GET /api/assets/:fileId/download` — permission check: request creator, assignee, uploader, lead, approver role, designated approver, or hierarchy manager can download.
- **List files**: `GET /api/requests/:id/files` — returns all uploaded files for a request with version info. Same permission scope as download.
- **Detail panel**: Uploaded assets shown prominently at top of request detail with LATEST file highlighted (primary border). Each file shows icon, version, filename, size, uploader, date, and download button. Files load asynchronously via `_loadAssetFilesIntoPanel()`.
- **Review & Approve section**: When request status is `under_review` or `first_cut`, approvers see a highlighted approval section with Approve/Request Changes/Reject buttons directly below the asset list. Reject sends status back to `changes_in_progress`.
- Frontend: `App.triggerAssetUpload()` for upload, `App.viewRequestFiles()` for file list modal, `App.downloadAsset()` for individual file download.

### Workload & Timesheet
- `DataService.getWorkload()` now filters to only show team members with active tasks assigned.
- `DataService.getActiveTeamMembers()` returns users who have any assigned requests (top-level or deliverable-level).
- Timesheet user switcher and team overview use `getActiveTeamMembers()` instead of `getDesigners()` to only show people with tasks.

### Port
App runs on port 5000 (required for Replit webview).
