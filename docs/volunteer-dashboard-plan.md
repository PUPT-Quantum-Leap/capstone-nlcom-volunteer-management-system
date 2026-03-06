# Volunteer Dashboard Implementation Plan

## Overview
Enhance the volunteer dashboard with:
1. Edit personal information of volunteer profile
2. Search ability (attendance data)
3. Attendance display (weekly/monthly/daily)
4. Team assignment display (Alpha, Bravo, etc.)

---

## Current State

### Backend
- Has `Volunteer` model with basic fields
- Has `Position` model (for volunteer deployment preferences: Mobile Kitchen, Logistics, etc.)
- Has related models: Availability, Experience, Lifegroup, Skill, Training
- Only basic auth endpoints exist

### Frontend
- Complete UI with 4 views (Overview, Profile, Schedule, Polls)
- Uses mock/static data
- Not connected to backend API

---

## Implementation Plan

### Phase 1: Database Setup

#### New Attendance Feature
- **Create Attendance model** - For manual hour logging
- **Create migration** - attendance table with fields:
  - volunteer_id
  - date
  - hours
  - description
  - status (pending/approved/rejected)
  - created_by
  - created_at

#### Update Volunteer Table (if needed)
- Add position_id field to link to team/position

### Phase 2: Backend API

#### Endpoints to Create
```
GET    /api/v1/volunteer/profile         - Get current volunteer profile
PUT    /api/v1/volunteer/profile         - Update volunteer profile
GET    /api/v1/volunteer/attendance      - List attendance (with filters)
POST   /api/v1/volunteer/attendance      - Add manual hours
GET    /api/v1/volunteer/attendance/stats - Get stats (weekly/monthly/daily)
GET    /api/v1/volunteer/search          - Search attendance data
```

#### Controllers
- Update `VolunteerController` with new methods

### Phase 3: Frontend

#### New Service
- Create `VolunteerService` for API calls

#### Dashboard Updates
1. **Profile Section**
   - Connect to real API for save/edit
   - Add Position/Team display field

2. **Attendance Section**
   - Weekly/Monthly/Daily toggle view
   - List of logged hours with status
   - Add new hour entry form
   - Search bar for filtering

3. **Overview Section**
   - Show attendance stats
   - Show assigned team/position

---

## Files to Modify/Create

### Backend
- `app/Models/Attendance.php` (new)
- `database/migrations/2026_03_01_000000_create_attendance_table.php`
- `app/Http/Controllers/VolunteerController.php` (update)
- `app/Http/Requests/UpdateVolunteerProfileRequest.php` (new)
- `app/Http/Requests/CreateAttendanceRequest.php` (new)
- `routes/api.php` (add routes)
- `database/seeders/PositionSeeder.php` (seed Alpha, Bravo, etc.)

### Frontend
- `src/app/services/volunteer.service.ts` (new)
- `src/app/models/volunteer-profile.ts` (update - add position/team)
- `src/app/models/attendance.ts` (new)
- `src/app/volunteer-dashboard/volunteer-dashboard.ts` (update)
- `src/app/volunteer-dashboard/volunteer-dashboard.html` (update)
- `src/app/volunteer-dashboard/volunteer-dashboard.scss` (update)

---

## Notes
- Position model stores volunteer deployment preferences (Mobile Kitchen, Logistics, etc.)
- Attendance is manual hour logging (not tied to events)
- Team assignment uses Position model

---

*Generated: March 1, 2026*
