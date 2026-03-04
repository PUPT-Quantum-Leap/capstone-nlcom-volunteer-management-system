# Volunteer Auth and Admin Auth & Dashboard Change Log

## Scope
This document summarizes implemented changes related to:
- Login/session handling
- Volunteer and admin dashboard route access
- Volunteer attendance permissions
- Admin dashboard data fetch troubleshooting

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

## Changed Files

### Backend
- `servetrack-backend/app/Http/Controllers/VolunteerController.php`
- `servetrack-backend/routes/api.php`
- `servetrack-backend/app/Http/Controllers/AdminController.php`

### Frontend
- `servetrack-frontend/src/app/auth/login/login.ts`
- `servetrack-frontend/src/app/guards/auth.guard.ts`
- `servetrack-frontend/src/app/services/volunteer.service.ts`
- `servetrack-frontend/src/app/volunteer-dashboard/volunteer-dashboard.html`
- `servetrack-frontend/src/app/volunteer-dashboard/volunteer-dashboard.ts`

### Tests/Styling
- `servetrack-frontend/src/app/services/auth.service.spec.ts`
- `servetrack-frontend/src/app/auth/login/login.spec.ts`
- `servetrack-frontend/src/app/auth/signup-form/signup-form.scss`
- `servetrack-backend/tests/Feature/AuthMiddlewareTest.php`

## Detailed Functional Changes

### 1) Login flow and routing behavior
- Login success shows a modal before navigation.
- Redirect destination is role-based.
- Current policy:
- `admin` redirects to `/admin-dashboard`.
- `volunteer` redirects to `/volunteer-dashboard`.
- `coordinator` no longer has admin-dashboard access and is routed to `/volunteer-dashboard`.

### 2) Session and authenticated edge handling
- Login flow handles backend `Already authenticated.` behavior without false login failure.
- Auth state parsing supports:
- Envelope responses: `{ success, user, message }`
- Raw user object responses from `/api/user`

### 3) Volunteer dashboard/profile UX
- Profile updates include:
- Confirmation step before persisting changes.
- Success modal after successful save.

### 4) Volunteer attendance permissions
- Volunteer attendance create route is not exposed for volunteer usage.
- Volunteer attendance create UI and service path were removed.
- Volunteer attendance is read-only from volunteer dashboard.

### 5) Admin dashboard role enforcement update
- `AdminController::dashboard` is now `admin` only.
- Coordinators are rejected by backend on admin dashboard endpoint access.

### 6) Admin dashboard 500 fix
- Updated eager-load select for positions from `positions:id,name` to `positions:position_id,name`.
- This aligns with actual schema (`position.position_id`) and prevents SQL/runtime errors during dashboard fetch.

## Security and Access Intent
- Keep volunteer dashboard available to authenticated volunteer/coordinator users.
- Restrict admin dashboard API and route access to admin users only.
- Prevent volunteer-side manual attendance insertion.

## Validation Notes
- Backend syntax check run:
- `php -l servetrack-backend/app/Http/Controllers/AdminController.php`
- Result: no syntax errors.
- Full frontend and backend suites were not rerun in this update pass.

## Quick Verification Checklist
1. Login as admin, open `/admin-dashboard`, and confirm dashboard loads without 500.
2. Verify volunteer list appears in admin dashboard table.
3. Login as coordinator, try `/admin-dashboard`, and confirm redirect/fallback to `/volunteer-dashboard`.
4. Login as volunteer, confirm volunteer dashboard access and read-only attendance behavior.
5. Optionally run:
```bash
cd servetrack-frontend && npm test
cd ../servetrack-backend && php artisan test --compact
```
