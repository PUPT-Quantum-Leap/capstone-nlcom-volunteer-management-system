# Volunteer and Admin Auth and Dashboard Change Log

## Scope
This document summarizes implemented changes related to:
- Login and session handling
- Volunteer and admin dashboard route access
- Volunteer attendance permissions
- Admin dashboard data fetch troubleshooting
- Dedicated admin authentication flow

## Timeline Summary

### Phase 1: Auth and volunteer dashboard flow
- Login supports success-modal flow with explicit continue-to-dashboard action.
- Auth handling supports both `/api/user` raw user responses and envelope-style responses.
- Volunteer profile update UX includes confirm-before-save and success modal feedback.

### Phase 2: Volunteer attendance restrictions
- Volunteer-side attendance creation was removed from both API exposure and frontend UI.
- Volunteer attendance view is read-only (view, search, filter, stats).

### Phase 3: Admin dashboard volunteer fetch issue (March 5, 2026)
- Issue observed: `GET /api/admin/dashboard` returned `500 Internal Server Error`.
- Root cause identified in eager-loading columns for `positions` relation.
- Role access policy was updated to remove coordinator access from admin dashboard.

### Phase 4: Split admin and volunteer login flows (March 5, 2026)
- Added dedicated admin login URL and API endpoint.
- Admin authentication now uses `/admin-login` (frontend) and `/api/admin/login` (backend).
- Volunteer login route `/login` now rejects admin accounts.

### Phase 5: Frontend test stability fixes (March 5, 2026)
- Fixed login component initialization to safely handle missing `ActivatedRoute.snapshot` in tests.
- Restored normalized invalid-credentials messaging for `401/422` login responses.
- Resolved CI failures in `login.spec.ts` and related auth-service assertion behavior.

## Changed Files

### Backend
- `servetrack-backend/app/Http/Controllers/VolunteerController.php`
- `servetrack-backend/app/Http/Controllers/AdminController.php`
- `servetrack-backend/app/Http/Controllers/Auth/LoginController.php`
- `servetrack-backend/routes/api.php`

### Frontend
- `servetrack-frontend/src/app/app.routes.ts`
- `servetrack-frontend/src/app/auth/login/login.ts`
- `servetrack-frontend/src/app/auth/admin-signup/admin-signup.ts`
- `servetrack-frontend/src/app/auth/admin-signup/admin-signup.html`
- `servetrack-frontend/src/app/guards/auth.guard.ts`
- `servetrack-frontend/src/app/services/auth.service.ts`
- `servetrack-frontend/src/app/services/volunteer.service.ts`
- `servetrack-frontend/src/app/volunteer-dashboard/volunteer-dashboard.ts`

### Build Config and Docs
- `servetrack-frontend/angular.json`
- `docs/volunteer-auth-dashboard-change-log.md`

## Detailed Functional Changes

### 1) Login flow and routing behavior
- Login success shows a modal before navigation.
- Redirect destination is role-based.
- Current policy:
- `admin` redirects to `/admin-dashboard`.
- `volunteer` redirects to `/volunteer-dashboard`.
- `coordinator` no longer has admin-dashboard access and falls back to `/volunteer-dashboard`.

### 2) Session and authenticated edge handling
- Login flow handles backend `Already authenticated.` responses by clearing existing session and retrying login with entered credentials.
- This prevents stale admin sessions from forcing users into the wrong dashboard.

### 3) Dedicated admin login URL and endpoint
- New frontend route: `/admin-login`.
- New backend endpoint: `POST /api/admin/login`.
- `admin-login` page uses admin endpoint only.
- Admin endpoint authenticates only users with `role = admin`.

### 4) Volunteer login endpoint restriction
- Standard login endpoint `POST /api/login` now blocks admin accounts.
- Response message: `Admin accounts must use /admin-login.`
- Frontend login error handling now returns normalized `Invalid email or password.` for 401/422 responses, while preserving sentinel `ERROR` for admin-only route enforcement.

### 5) Admin signup sign-in behavior
- Admin signup footer "Sign in" link now routes to `/admin-login`.
- Admin signup success modal redirect and CTA now route to `/admin-login`.

### 6) Volunteer attendance permissions
- Manual attendance creation flow is removed from volunteer frontend service and dashboard component.
- Volunteer attendance remains read-only in UI and API usage.

### 7) Admin dashboard access and data fixes
- `AdminController::dashboard` is now admin-only.
- Coordinator access to admin dashboard is removed in frontend guard and login routing logic.
- Fixed admin dashboard volunteer fetch by changing eager-loaded position key:
- `positions:id,name` -> `positions:position_id,name`

### 8) Build warning budget adjustment
- Updated Angular production warning budgets to match current bundle/profile:
- `initial.maximumWarning`: `500kB` -> `650kB`
- `anyComponentStyle.maximumWarning`: `20kB` -> `24kB`

### 9) Login test resilience and error consistency
- Added optional chaining for login route detection:
- `this.route.snapshot?.routeConfig?.path`
- This prevents runtime `TypeError` when route snapshot is omitted by test doubles.
- Kept consistent invalid-login copy for better UX and stable test expectations.

## Security and Access Intent
- Keep volunteer dashboard available to authenticated volunteers.
- Restrict admin dashboard and admin login flow to admin users only.
- Prevent admin account usage through volunteer login path.
- Prevent volunteer-side manual attendance insertion.

## Validation Notes
- Backend checks run:
- `php -l servetrack-backend/app/Http/Controllers/AdminController.php`
- `php -l servetrack-backend/app/Http/Controllers/Auth/LoginController.php`
- `php artisan route:list --path=admin/login`
- Frontend checks run:
- `cd servetrack-frontend && npm run build`
- `cd servetrack-frontend && npm test`

## Quick Verification Checklist
1. Open `http://localhost:4200/admin-login` and sign in as admin -> lands on `/admin-dashboard`.
2. Open `http://localhost:4200/login` and try admin credentials -> receives admin-login instruction and is denied.
3. Sign in with volunteer credentials at `/login` -> lands on `/volunteer-dashboard`.
4. From admin signup page, click "Sign in" -> routes to `/admin-login`.
5. Complete admin signup success flow -> auto-redirect goes to `/admin-login`.
6. Open admin dashboard -> volunteer table loads without 500 errors.
