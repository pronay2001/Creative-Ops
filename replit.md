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

### Campaigns
- **Types**: `show`, `work_material`, `branded_content`. Type + release date selected at creation.
- **Release date**: required for Show and Branded Content; not allowed for Work Material. Mirrored to `go_live_date` of every auto-generated request.
- **Auto-generated requests** (created atomically in same transaction as campaign):
  - Show (4): Teaser → `teaser_first_look`, AV → `announcement_video`, Poster → `poster`, Trailer → `trailer`.
  - Branded Content (9): Poster, Trailer, Trailer Byte Story (`stories`), Stream Now (`post_4_5_brand`), Stream Now Byte Story (`stories`), Brand Reel 1 (`organic_reel`), Brand Reel 2 (`organic_reel`), Branded Static (`post_4_5_brand`), Celebrity Vignette (`hoichoi_brand_promo`).
  - Each auto-request needs a per-row Internal Deadline + Team (Graphics/Video/Motion Graphics) chosen by the admin in the modal. Auto-requests get assigned to the team lead, status=`intake`, approver_id=null, vertical/department blank — admin edits later.
- **Permissions**: Create + Edit + Delete = hierarchy admin only (POST/PATCH/DELETE `/api/campaigns`). Edit affordance hidden via `Permissions.isAdmin()` on detail page.
- **Server constants**: `CAMPAIGN_TYPES` and `CAMPAIGN_AUTO_REQUEST_PRESETS` in `server.js` are the source of truth for type IDs and preset asset-type mapping. Mirror lists in `public/app.js` (`CAMPAIGN_TYPE_LABELS`, `CAMPAIGN_AUTO_REQUEST_PRESETS`) — keep titles/order in sync.

### External Integrations
- **CSV Employee Import**: Upload HR CSV via `POST /api/users/import-csv` (multer + csv-parse). Auto-detects column headers, infers roles from designation, upserts by email. Lead-only.
- **Microsoft Graph Email**: Notifications via OAuth 2.0 client credentials (`services/email.js`). Sends branded HTML emails (`services/email-templates.js`) on: task assignment (including at creation), status changes, new comments, approval decisions. Requires AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, MAIL_FROM env vars. Fails gracefully when not configured.
- **Microsoft Teams DMs**: `services/teams.js` mirrors `services/email.js` and sends 1:1 chat messages from the bot user (MAIL_FROM, or TEAMS_BOT_USER_ID if pinned) to the same recipients via Graph (`POST /chats` + `POST /chats/{id}/messages`). Reuses `getToken()` exported from `services/email.js`. Email + Teams fan-out is centralised in `notify(to, subject, html, requestId)` in server.js — both channels run concurrently via `Promise.allSettled`; Teams failures are logged and never block email. Each notification HTML body is augmented with a "Open in CreativeOps →" CTA pointing at `<APP_BASE_URL>/#requests/<id>`. Required Graph application permissions on the existing app registration: `Mail.Send`, `Chat.Create`, `ChatMessage.Send`, `User.Read.All` (admin consent). Optional env: `TEAMS_BOT_USER_ID` (pins bot identity), `APP_BASE_URL` (deep link base — falls back to APP_URL → REPLIT_DOMAINS → REPLIT_DEV_DOMAIN → localhost). Admin-only smoke test: `POST /api/diagnostics/teams-test` DMs the calling admin.
- **Deep links**: Hash route `#requests/<id>` navigates to the Requests view and auto-opens that request's detail panel (handled in `navigate()` in public/app.js).
- **Calendar**: In-app monthly calendar with "My Tasks" / "All Tasks" toggle plus Platform (vertical) and Team (Video/Graphics/Motion Graphics) filter dropdowns in the header. Filter selections are session-only module state (`calendarVerticalFilter`, `calendarTeamFilter` in app.js), intersect with the My/All toggle, surface as removable filter pills, and are honored by both the month grid and the day-detail popup. Shows go-live dates and internal deadlines. Drag-and-drop rescheduling. `requestFromRow` in storage-client.js exposes `vertical` so the filter can match.

### Environment Variables
See `.env.example` for full list. Key ones:
- `DATABASE_URL` - PostgreSQL connection (auto-set by Replit)
- `SESSION_SECRET` - Express session secret
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `MAIL_FROM` - Email

### Database
PostgreSQL with tables: users, campaigns, requests, deliverables, comments, activity_log, timesheet_entries, timesheet_clock, knowledge_entries, content_schedule, asset_files. Schema auto-migrates on server start.
- `campaigns.campaign_type` TEXT (`show` | `work_material` | `branded_content`) and `campaigns.release_date` DATE.
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

### Form Draft Autosave
- Per-user localStorage drafts (key: `creativeops:draft:<userId|anon>:<formKey>`) on all create/edit modals and notes — New Request (`newRequest`, includes `modalDeliverables` array), New/Edit Campaign (`newCampaign`, `editCampaign:<id>`), Edit Campaign Request (`editCampaignRequest:<id>`), KB entry (`kbEntry:<campaignId>`), comment input on request detail (`comment:<reqId>`), approval popover notes (`approval:<reqId>:<action>`).
- Helpers in `public/app.js` near the top: `_draftLoad/_draftSave/_draftClear/_draftClearPrefix/_draftPurgeOld`, `_snapshotFormFields/_restoreFormFields`, `_wireFormDraft(root, key, opts)`, `_showDraftBanner`. Debounced 400 ms, listens on `input`/`change` in capture, skips password/file/hidden + `[data-no-draft]` inputs.
- Drafts persist on Cancel (user preference) and are cleared only after successful submit. A "Draft restored · saved Xm ago" pill with Discard button appears at the top of the form when a draft is loaded; Discard wipes storage and re-opens the form blank.
- Stale drafts (>14 days) are purged once on `App.init()`.
- Deliverable mutations (`addModalDeliverable`/`removeModalDeliverable`/`updateModalDeliverable`/`toggleModalDelPlatform`/`_pickDelAsset`) call `_triggerDraftSave('modalBody')` to capture the array snapshot.

### Port
App runs on port 5000 (required for Replit webview).
