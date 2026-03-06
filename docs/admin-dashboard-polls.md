# Admin Dashboard - Polls Management Documentation

## Overview

The Polls Management feature allows administrators to create, manage, and monitor volunteer polls and surveys. This feature is integrated into the Admin Dashboard and provides a complete CRUD (Create, Read, Update, Delete) interface for managing polls.

**Created**: March 6, 2026  
**Version**: 1.0.0  
**Location**: `servetrack-frontend/src/app/admin-dashboard/`

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [User Interface](#user-interface)
- [Data Models](#data-models)
- [Service API](#service-api)
- [Usage Guide](#usage-guide)
- [Component Structure](#component-structure)
- [Styling](#styling)
- [API Integration](#api-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Features

### Core Functionality

- ✅ **Create Polls**: Create new polls with custom title, date, description, and multiple options
- ✅ **Edit Polls**: Modify existing poll details and options
- ✅ **Delete Polls**: Remove polls with confirmation modal
- ✅ **Status Management**: Change poll status between Active, Draft, and Closed
- ✅ **Filter Polls**: Filter polls by status (All/Active/Draft/Closed)
- ✅ **Real-time Updates**: View live vote counts and capacity tracking
- ✅ **Progress Visualization**: Visual progress bars showing votes/capacity
- ✅ **Responsive Design**: Mobile-friendly interface

### Poll Options

Each poll can have multiple options with:
- **Time Slot**: Custom time slot text (e.g., "4:30am - 2:00pm")
- **Capacity**: Maximum number of votes allowed
- **Vote Tracking**: Current vote count
- **Progress Bar**: Visual representation of votes vs capacity
- **Status Indicators**: "FULL" badge when capacity reached

## Architecture

### Component Hierarchy

```
AdminDashboard
├── polls-layout (Poll Management View)
│   ├── polls-header (Title + Create Button)
│   ├── polls-filters (Status Filter Tabs)
│   ├── polls-grid (Poll Cards Grid)
│   │   └── poll-item-card (Individual Poll Card)
│   └── empty-state (No Polls Message)
├── poll-modal (Create/Edit Modal)
│   └── pollForm (Reactive Form)
└── delete-modal (Delete Confirmation)
```

### File Structure

```
servetrack-frontend/
├── src/app/
│   ├── models/
│   │   └── poll.ts                    # Poll data models
│   ├── services/
│   │   └── poll.service.ts            # Poll CRUD service
│   └── admin-dashboard/
│       ├── admin-dashboard.ts         # Main component
│       ├── admin-dashboard.html       # Template with polls section
│       └── admin-dashboard.scss       # Styles including poll styles
└── docs/
    └── admin-dashboard-polls.md       # This documentation
```

## User Interface

### Main Polls View

The polls management interface consists of:

1. **Header Section**
   - Title: "Polls Management"
   - Description: "Create, manage, and monitor volunteer polls and surveys"
   - "Create New Poll" button (blue, with plus icon)

2. **Filter Tabs**
   - All Polls (default)
   - Active (green badge)
   - Draft (yellow badge)
   - Closed (red badge)

3. **Polls Grid**
   - Responsive grid layout (auto-fill, min 400px per card)
   - Poll cards with hover effects
   - Empty state when no polls match filters

### Poll Card Layout

Each poll card displays:

```
┌─────────────────────────────────────────┐
│ [Title]                    [Status Badge]│
│ [Edit] [Delete] buttons                  │
├─────────────────────────────────────────┤
│ 📅 Date          🕐 Cut-off Time        │
│ Description text...                      │
│                                          │
│ ┌── Poll Options ──────────────────┐   │
│ │ Time Slot 1          10/15        │   │
│ │ ████████░░ 66.7%                  │   │
│ │ 5 slots remaining                 │   │
│ └───────────────────────────────────┘   │
│                                          │
│ 👥 19 total votes    [Action Button]    │
└─────────────────────────────────────────┘
```

### Create/Edit Modal

The modal form includes:

```
┌─────────────────────────────────────────┐
│ Create New Poll / Edit Poll          ✕  │
├─────────────────────────────────────────┤
│ Poll Title *                             │
│ [________________]  [Event Date *_____] │
│                                          │
│ Cut-off Day *       Cut-off Time *      │
│ [____________]      [______________]    │
│                                          │
│ Description *                            │
│ [_________________________________]     │
│                                          │
│ Poll Options *          [+ Add Option]  │
│ ┌─────────────────────────────────┐    │
│ │ ① Time Slot         Capacity  ✕ │    │
│ │   [___________]     [____]       │    │
│ └─────────────────────────────────┘    │
│                                          │
│         [Cancel]  [Create/Update Poll]  │
└─────────────────────────────────────────┘
```

**Modal Specifications**:
- Max width: 900px
- Width: 90vw (responsive)
- Max height: 90vh
- Scrollable content area

## Data Models

### Poll Interface

```typescript
interface Poll {
  id: number;
  title: string;
  date: string;
  cutOffDay: string;
  cutOffTime: string;
  description: string;
  status: 'active' | 'closed' | 'draft';
  totalVotes: number;
  createdAt: string;
  options: PollOption[];
}
```

### PollOption Interface

```typescript
interface PollOption {
  id: number;
  timeSlot: string;
  votes: number;
  capacity: number;
  selected?: boolean;
}
```

### CreatePollDto

```typescript
interface CreatePollDto {
  title: string;
  date: string;
  cutOffDay: string;
  cutOffTime: string;
  description: string;
  options: CreatePollOptionDto[];
}

interface CreatePollOptionDto {
  timeSlot: string;
  capacity: number;
}
```

## Service API

### PollService Methods

#### `getPolls(): Observable<Poll[]>`
Retrieves all polls from the backend/mock data.

**Returns**: Observable of Poll array

**Example**:
```typescript
this.pollService.getPolls().subscribe((polls) => {
  this.polls.set(polls);
});
```

#### `getPollById(id: number): Observable<Poll | undefined>`
Retrieves a specific poll by ID.

**Parameters**:
- `id`: Poll ID

**Returns**: Observable of Poll or undefined

#### `createPoll(dto: CreatePollDto): Observable<Poll>`
Creates a new poll.

**Parameters**:
- `dto`: CreatePollDto object with poll details

**Returns**: Observable of created Poll

**Example**:
```typescript
const dto: CreatePollDto = {
  title: 'Mobile Kitchen Operations',
  date: 'Sept 27',
  cutOffDay: 'THURSDAY',
  cutOffTime: '12NN',
  description: 'Select your preferred time slot',
  options: [
    { timeSlot: '4:30am - 2:00pm', capacity: 15 },
    { timeSlot: '4:30am - 7:00pm', capacity: 10 }
  ]
};

this.pollService.createPoll(dto).subscribe((poll) => {
  console.log('Poll created:', poll);
});
```

#### `updatePoll(id: number, dto: Partial<CreatePollDto>): Observable<Poll | undefined>`
Updates an existing poll.

**Parameters**:
- `id`: Poll ID to update
- `dto`: Partial CreatePollDto with fields to update

**Returns**: Observable of updated Poll or undefined

#### `deletePoll(id: number): Observable<boolean>`
Deletes a poll.

**Parameters**:
- `id`: Poll ID to delete

**Returns**: Observable of boolean (true on success)

#### `updatePollStatus(id: number, status: 'active' | 'closed' | 'draft'): Observable<boolean>`
Updates a poll's status.

**Parameters**:
- `id`: Poll ID
- `status`: New status ('active', 'closed', or 'draft')

**Returns**: Observable of boolean (true on success)

**Example**:
```typescript
// Activate a draft poll
this.pollService.updatePollStatus(pollId, 'active').subscribe(() => {
  this.loadPolls();
});
```

## Usage Guide

### Creating a New Poll

1. Navigate to Admin Dashboard → Polls
2. Click "Create New Poll" button
3. Fill in the form:
   - **Poll Title**: Descriptive name (min 3 characters)
   - **Event Date**: Date of the event (e.g., "Sept 27")
   - **Cut-off Day**: Last day to vote (e.g., "THURSDAY")
   - **Cut-off Time**: Cut-off time (e.g., "12NN")
   - **Description**: Purpose of the poll (min 10 characters)
   - **Poll Options**: Add at least 2 options with time slots and capacity
4. Click "Add Option" to add more options
5. Click "Create Poll" to save (starts as Draft status)

### Editing a Poll

1. Find the poll card
2. Click the Edit button (pencil icon)
3. Modify fields as needed
4. Click "Update Poll" to save changes

**Note**: Editing active polls with existing votes may affect vote data

### Deleting a Poll

1. Find the poll card
2. Click the Delete button (trash icon)
3. Confirm deletion in the modal
4. Poll and all vote data will be permanently removed

### Managing Poll Status

**Draft → Active**:
- Click "Activate" button on draft poll
- Poll becomes visible to volunteers

**Active → Closed**:
- Click "Close Poll" button on active poll
- No more votes accepted, results visible

**Closed → Active**:
- Click "Reopen" button on closed poll
- Poll accepts votes again

### Filtering Polls

Use the filter tabs to view:
- **All Polls**: Shows all polls regardless of status
- **Active**: Currently open for voting
- **Draft**: Not yet published
- **Closed**: Voting has ended

## Component Structure

### Admin Dashboard Component

**Key Signals**:
```typescript
polls = signal<Poll[]>([]);
pollFilterStatus = signal<'all' | 'active' | 'closed' | 'draft'>('all');
showPollModal = signal(false);
showDeletePollModal = signal(false);
editingPoll = signal<Poll | null>(null);
deletingPollId = signal<number | null>(null);
```

**Computed Signals**:
```typescript
filteredPolls = computed(() => {
  const status = this.pollFilterStatus();
  if (status === 'all') return this.polls();
  return this.polls().filter((poll) => poll.status === status);
});
```

**Reactive Form**:
```typescript
pollForm = this.fb.group({
  title: ['', [Validators.required, Validators.minLength(3)]],
  date: ['', Validators.required],
  cutOffDay: ['', Validators.required],
  cutOffTime: ['', Validators.required],
  description: ['', [Validators.required, Validators.minLength(10)]],
  options: this.fb.array([]),
});
```

### Key Methods

#### Modal Management
- `openCreatePollModal()`: Opens modal for new poll
- `openEditPollModal(poll: Poll)`: Opens modal with existing poll data
- `closePollModal()`: Closes the poll modal
- `confirmDeletePoll(pollId: number)`: Opens delete confirmation
- `closeDeletePollModal()`: Closes delete confirmation

#### Form Operations
- `addPollOption()`: Adds new option to form array
- `removePollOption(index: number)`: Removes option from form array
- `savePoll()`: Validates and saves poll (create or update)
- `deletePoll()`: Confirms and deletes poll

#### Status Management
- `updatePollStatus(pollId: number, status)`: Changes poll status
- `setPollFilterStatus(status)`: Updates filter selection

#### Helper Methods
- `getVotePercentage(poll: Poll, option: PollOption): number`: Calculates vote percentage
- `getRemainingSlots(option: PollOption): number`: Calculates remaining capacity
- `isFull(option: PollOption): boolean`: Checks if option is at capacity

## Styling

### CSS Classes

**Layout Classes**:
- `.polls-layout`: Main container
- `.polls-header`: Header with title and create button
- `.polls-filters`: Filter tabs container
- `.polls-grid`: Responsive grid for poll cards

**Card Classes**:
- `.poll-item-card`: Individual poll card
- `.poll-item-header`: Card header with title and actions
- `.poll-item-meta`: Date and time metadata
- `.poll-item-description`: Poll description text
- `.poll-options-preview`: Options preview container
- `.poll-item-footer`: Footer with vote count and actions

**Status Badges**:
- `.poll-status-badge`: Base badge class
- `.status-active`: Green (active polls)
- `.status-draft`: Yellow (draft polls)
- `.status-closed`: Red (closed polls)

**Progress Indicators**:
- `.option-preview-progress`: Progress bar container
- `.option-preview-fill`: Filled portion of progress bar
- `.option-slots`: Remaining/full slot indicator

**Modal Classes**:
- `.poll-modal`: Poll create/edit modal
- `.delete-modal`: Delete confirmation modal
- `.modal-header`: Modal header with title and close
- `.form-grid`: 2-column form grid
- `.form-group`: Form field container
- `.poll-options-form`: Options form array container

**Button Classes**:
- `.add-poll-btn`: Create new poll button
- `.poll-action-btn`: Edit/delete action buttons
- `.status-action-btn`: Status change buttons
- `.add-option-btn`: Add option button
- `.remove-option-btn`: Remove option button

### Color Scheme

**Status Colors**:
- Active: `#d1fae5` (bg), `#065f46` (text)
- Draft: `#fef3c7` (bg), `#92400e` (text)
- Closed: `#fee2e2` (bg), `#991b1b` (text)

**Progress Colors**:
- Normal: Blue gradient (`#2563eb` → `#1d4ed8`)
- Full: Red gradient (`#dc2626` → `#ef4444`)
- Available slots: `#059669` (green)
- Full slots: `#dc2626` (red)

### Responsive Breakpoints

**Mobile (≤768px)**:
- Single column grid
- Stacked header elements
- Full-width buttons
- Single column form

**Desktop (>768px)**:
- Multi-column grid (auto-fill, min 400px)
- Side-by-side header elements
- 2-column form grid

## API Integration

Currently using mock data in `PollService`. To integrate with backend:

### 1. Update PollService

```typescript
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Poll, CreatePollDto } from '../models/poll';

@Injectable({
  providedIn: 'root',
})
export class PollService {
  private http = inject(HttpClient);
  private apiUrl = '/api/polls';

  getPolls(): Observable<Poll[]> {
    return this.http.get<Poll[]>(`${this.apiUrl}`).pipe(
      catchError(this.handleError<Poll[]>('getPolls', []))
    );
  }

  getPollById(id: number): Observable<Poll> {
    return this.http.get<Poll>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError<Poll>('getPollById'))
    );
  }

  createPoll(dto: CreatePollDto): Observable<Poll> {
    return this.http.post<Poll>(`${this.apiUrl}`, dto).pipe(
      catchError(this.handleError<Poll>('createPoll'))
    );
  }

  updatePoll(id: number, dto: Partial<CreatePollDto>): Observable<Poll> {
    return this.http.put<Poll>(`${this.apiUrl}/${id}`, dto).pipe(
      catchError(this.handleError<Poll>('updatePoll'))
    );
  }

  deletePoll(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError<void>('deletePoll'))
    );
  }

  updatePollStatus(id: number, status: string): Observable<Poll> {
    return this.http.patch<Poll>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      catchError(this.handleError<Poll>('updatePollStatus'))
    );
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      return of(result as T);
    };
  }
}
```

### 2. Backend API Endpoints

Expected Laravel backend endpoints:

```php
// routes/api.php
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/polls', [PollController::class, 'index']);
    Route::get('/polls/{id}', [PollController::class, 'show']);
    Route::post('/polls', [PollController::class, 'store']);
    Route::put('/polls/{id}', [PollController::class, 'update']);
    Route::delete('/polls/{id}', [PollController::class, 'destroy']);
    Route::patch('/polls/{id}/status', [PollController::class, 'updateStatus']);
});
```

### 3. Expected API Response Format

```json
// GET /api/polls
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Mobile Kitchen Operations",
      "date": "Sept 27",
      "cutOffDay": "THURSDAY",
      "cutOffTime": "12NN",
      "description": "Select your preferred time slot",
      "status": "active",
      "totalVotes": 19,
      "createdAt": "2026-09-20T10:00:00Z",
      "options": [
        {
          "id": 1,
          "timeSlot": "4:30am - 2:00pm",
          "votes": 10,
          "capacity": 15
        }
      ]
    }
  ]
}

// POST /api/polls (request)
{
  "title": "Community Outreach Program",
  "date": "Oct 15",
  "cutOffDay": "MONDAY",
  "cutOffTime": "6PM",
  "description": "Vote for your preferred shift",
  "options": [
    { "timeSlot": "8:00am - 12:00pm", "capacity": 20 },
    { "timeSlot": "12:00pm - 4:00pm", "capacity": 15 }
  ]
}

// POST /api/polls (response)
{
  "success": true,
  "data": {
    "id": 4,
    "title": "Community Outreach Program",
    "date": "Oct 15",
    "cutOffDay": "MONDAY",
    "cutOffTime": "6PM",
    "description": "Vote for your preferred shift",
    "status": "draft",
    "totalVotes": 0,
    "createdAt": "2026-03-06T04:03:55Z",
    "options": [...]
  },
  "message": "Poll created successfully"
}
```

## Best Practices

### Form Validation

- Always validate before submission
- Mark all fields as touched on submit attempt
- Show error messages below invalid fields
- Require minimum 1 poll option (enforce 2+ for usability)

### Data Management

- Load polls on component init
- Reload polls after create/update/delete operations
- Use signals for reactive state management
- Clear form state when closing modals

### User Experience

- Show loading state during operations
- Provide confirmation before destructive actions
- Display empty state with helpful message
- Use visual feedback (hover effects, transitions)
- Disable buttons during async operations

### Performance

- Use computed signals for derived data
- Filter polls on the client side for responsiveness
- Lazy load poll data if list grows large
- Consider pagination for 100+ polls

### Security

- Validate all inputs on frontend and backend
- Sanitize HTML in descriptions
- Check user permissions before operations
- Use CSRF protection for state-changing operations
- Rate limit poll creation to prevent abuse

## Troubleshooting

### Common Issues

**Issue**: Poll modal doesn't open  
**Solution**: Check that `showPollModal` signal is properly set to `true`

**Issue**: Form validation errors not showing  
**Solution**: Ensure form controls are touched and use template conditionals correctly

**Issue**: Poll options not saving  
**Solution**: Verify FormArray is populated and mapped correctly in `savePoll()`

**Issue**: Filter not working  
**Solution**: Check `pollFilterStatus` signal and `filteredPolls` computed logic

**Issue**: Delete confirmation not appearing  
**Solution**: Ensure `showDeletePollModal` is true and `deletingPollId` is set

**Issue**: TypeScript type errors in form mapping  
**Solution**: Use type assertion: `(formValue.options as Array<{ timeSlot: string; capacity: number }>)`

**Issue**: Modal too narrow on desktop  
**Solution**: Verify `.poll-modal` has `max-width: 900px` and `width: 90vw`

**Issue**: Progress bars not displaying correctly  
**Solution**: Check that vote/capacity calculations are correct and styles are applied

## Future Enhancements

Potential features for future development:

- [ ] Poll scheduling (auto-activate on date)
- [ ] Email notifications to volunteers
- [ ] Poll templates for quick creation
- [ ] Export poll results to CSV/PDF
- [ ] Poll analytics dashboard
- [ ] Duplicate poll functionality
- [ ] Multi-select polls (select multiple options)
- [ ] Anonymous vs identified voting
- [ ] Poll comments/feedback
- [ ] Archive polls instead of delete
- [ ] Real-time vote updates with WebSockets
- [ ] Poll deadline countdown timer
- [ ] Volunteer notification preferences
- [ ] Poll results visualization (charts)
- [ ] Integration with calendar events

## Related Documentation

- [Admin Dashboard Main Documentation](../servetrack-frontend/AGENTS.md)
- [Angular 21 Documentation](https://angular.dev/)
- [Reactive Forms Guide](https://angular.dev/guide/forms/reactive-forms)
- [Signals Documentation](https://angular.dev/guide/signals)
- [Project Guidelines](../AGENTS.md)
- [Product Requirements](../PRD.md)

## Support

For questions or issues:
- Review this documentation
- Check `servetrack-frontend/AGENTS.md` for coding guidelines
- Refer to Angular 21 documentation for framework features
- Review existing code in `admin-dashboard.ts` for implementation details
- Contact the development team for technical support

---

**Document Information**  
**Created**: March 6, 2026  
**Last Updated**: March 6, 2026  
**Version**: 1.0.0  
**Author**: ServeTrack Development Team  
**Location**: `docs/admin-dashboard-polls.md`
