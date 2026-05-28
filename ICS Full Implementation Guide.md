# ICS Full Implementation — ServeTrack

## Status: What's Already Built vs What's Missing

### ✅ Already Implemented

- ICS Model, Controller, Service (backend)
- IcsDashboardResource with command roles & operational branches
- AI suggestions via Groq with skill-based fallback
- Frontend component: org chart, team cards, AI suggestion block, RSVP selector
- Command role inline editing
- Volunteer assign/remove

### ❌ Gaps to Fill

1. **PDF Export** (the primary business purpose)
2. `moveVolunteer()` — not wired
3. `addVolunteer()` manual search — not wired
4. **Shift-aware team placement** (AM/PM from `time_slot`)
5. **Meal Breakdown** stats (Breakfast, Lunch, Snacks)
6. **Objective & Menu** metadata fields on ICS
7. **Symbols/Legend** (new volunteer, driver, team leader)

---

## 1. DATABASE MIGRATIONS (New)

### Migration: Add metadata columns to `ics` table

```php
<?php
// database/migrations/2026_05_29_000001_add_metadata_to_ics_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('ics', function (Blueprint $table): void {
            $table->unsignedInteger('objective')->nullable()->after('location');
            $table->string('menu')->nullable()->after('objective');
            $table->unsignedInteger('meal_breakfast')->default(0)->after('menu');
            $table->unsignedInteger('meal_lunch')->default(0)->after('meal_breakfast');
            $table->unsignedInteger('meal_snacks')->default(0)->after('meal_lunch');
        });
    }

    public function down(): void
    {
        Schema::table('ics', function (Blueprint $table): void {
            $table->dropColumn(['objective', 'menu', 'meal_breakfast', 'meal_lunch', 'meal_snacks']);
        });
    }
};

```

### Update Ics Model

```php
// app/Models/Ics.php — add to $fillable:
protected $fillable = [
    'rsvp_id',
    'name',
    'description',
    'date',
    'location',
    'status',
    'ai_suggestions',
    'objective',        // NEW
    'menu',             // NEW
    'meal_breakfast',   // NEW
    'meal_lunch',       // NEW
    'meal_snacks',      // NEW
];

```

---

## 2. BACKEND: PDF EXPORT

### Install DomPDF (if not already)

```bash
composer require barryvdh/laravel-dompdf

```

### Route

```php
// routes/api.php
Route::get('/ics/{id}/export-pdf', [IcsController::class, 'exportPdf']);

```

### Controller Method

```php
// app/Http/Controllers/IcsController.php

use Barryvdh\DomPDF\Facade\Pdf;

public function exportPdf(int $id): \Illuminate\Http\Response|JsonResponse
{
    $ics = Ics::query()
        ->with(['rsvp', 'icsTeams', 'commandRoles', 'volunteers' => fn ($q) => $q->with('skills')])
        ->find($id);

    if (! $ics) {
        return response()->json(['message' => 'ICS not found.'], 404);
    }

    $dashboard = new IcsDashboardResource($this->loadDashboard($ics->id));
    $dashboardData = $dashboard->toArray(request());

    $pdf = Pdf::loadView('pdfs.ics-export', [
        'ics' => $ics,
        'dashboard' => $dashboardData,
    ]);

    $pdf->setPaper('A4', 'portrait');

    $filename = 'ICS_' . str_replace(' ', '_', $ics->name) . '_' . $ics->date->format('Y-m-d') . '.pdf';

    return $pdf->download($filename);
}

```

### Blade Template for PDF

```blade
{{-- resources/views/pdfs/ics-export.blade.php --}}
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ICS - {{ $ics->name }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 10px; color: #1e293b; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
        .header h1 { font-size: 16px; font-weight: 800; text-transform: uppercase; }
        .header-meta { display: flex; justify-content: space-between; margin-top: 8px; font-size: 9px; }
        .header-meta-item { display: inline-block; margin-right: 20px; }
        .org-chart { text-align: center; margin-bottom: 24px; }
        .org-node { display: inline-block; border: 1.5px solid #1e293b; padding: 6px 12px; margin: 4px; min-width: 140px; text-align: center; }
        .org-node .role { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #2563eb; }
        .org-node .name { font-size: 10px; font-weight: 600; margin-top: 2px; }
        .level { margin: 8px 0; }
        .connector { text-align: center; font-size: 12px; color: #64748b; }
        .branches { width: 100%; margin-top: 16px; }
        .branch-col { display: inline-block; vertical-align: top; width: 32%; margin-right: 1%; }
        .branch-header { font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 1.5px solid #1e293b; padding-bottom: 4px; margin-bottom: 8px; }
        .branch-director { font-size: 9px; font-style: italic; color: #64748b; margin-bottom: 8px; }
        .team-box { border: 1px solid #1e293b; margin-bottom: 8px; padding: 6px 8px; }
        .team-box .team-name { font-size: 9px; font-weight: 700; text-transform: uppercase; margin-bottom: 3px; }
        .team-box .team-location { font-size: 8px; color: #64748b; font-style: italic; }
        .team-box .volunteers { font-size: 9px; margin-top: 4px; }
        .team-box .vol-name { display: inline; }
        .team-box .vol-symbol { font-size: 8px; vertical-align: super; }
        .footer-section { margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 12px; }
        .footer-grid { width: 100%; }
        .footer-col { display: inline-block; vertical-align: top; width: 32%; margin-right: 1%; }
        .footer-col h4 { font-size: 9px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 3px; }
        .footer-col p, .footer-col li { font-size: 9px; margin-bottom: 2px; }
        .footer-col ul { list-style: none; }
        .vehicle-box { border: 1.5px solid #d97706; padding: 8px; margin-top: 8px; }
        .vehicle-box h4 { color: #d97706; }
    </style>
</head>
<body>
    <div class="header">
        <h1>MOBILE KITCHEN OPERATIONS</h1>
        <div class="header-meta">
            <span class="header-meta-item"><strong>OBJECTIVE:</strong> {{ $ics->objective ?? 'N/A' }}</span>
            <span class="header-meta-item"><strong>MENU:</strong> {{ $ics->menu ?? 'N/A' }}</span>
            <span class="header-meta-item"><strong>DATE:</strong> {{ $ics->date->format('F j, Y') }}</span>
            <span class="header-meta-item"><strong>VOLUNTEERS:</strong> {{ $dashboard['branches'] ? collect($dashboard['branches'])->sum(fn($b) => collect($b['teams'])->sum(fn($t) => count($t['assigned_volunteers']))) : 0 }}</span>
        </div>
    </div>

    {{-- ORG CHART --}}
    <div class="org-chart">
        @php
            $roles = collect($dashboard['command_roles'])->keyBy('key');
        @endphp
        <div class="level">
            <div class="org-node">
                <div class="role">Responsible Official</div>
                <div class="name">{{ $roles['responsible_official']['assigned_name'] ?? 'Unassigned' }}</div>
            </div>
        </div>

        <div class="connector">↓</div>

        <div class="level">
            <div class="org-node">
                <div class="role">Incident Commander</div>
                <div class="name">{{ $roles['incident_commander']['assigned_name'] ?? 'Unassigned' }}</div>
            </div>
        </div>

        <div class="connector">↓</div>

        <div class="level">
            @foreach (['planning', 'purchasing', 'mwc_coordinator', 'safety_emergency'] as $key)
                <div class="org-node">
                    <div class="role">{{ $roles[$key]['title'] ?? ucfirst(str_replace('_', ' ', $key)) }}</div>
                    <div class="name">{{ $roles[$key]['assigned_name'] ?? 'Unassigned' }}</div>
                </div>
            @endforeach
        </div>
    </div>

    {{-- OPERATIONAL BRANCHES --}}
    <div class="branches">
        @foreach ($dashboard['branches'] as $branch)
            <div class="branch-col">
                <div class="branch-header">{{ $branch['title'] }}</div>
                @php
                    $directorKey = match($branch['key']) {
                        'mobile_kitchen' => 'mobile_kitchen_director',
                        'am_distribution' => 'am_distribution_director',
                        'pm_distribution' => 'pm_distribution_director',
                        default => null,
                    };
                @endphp
                @if ($directorKey && isset($roles[$directorKey]))
                    <div class="branch-director">{{ $roles[$directorKey]['assigned_name'] }}</div>
                @endif

                @foreach ($branch['teams'] as $team)
                    <div class="team-box">
                        <div class="team-name">
                            {{ $team['name'] }}
                            @if ($team['vehicle'])
                                <span class="team-location">({{ $team['vehicle'] }})</span>
                            @endif
                        </div>
                        <div class="volunteers">
                            @foreach ($team['assigned_volunteers'] as $vol)
                                <span class="vol-name">{{ $vol['name'] }}</span>@if ($vol['is_leader'])<span class="vol-symbol">^</span>@endif
                                @if ($vol['is_driver'])<span class="vol-symbol">~</span>@endif
                                @if (!$loop->last), @endif
                            @endforeach
                            @if (empty($team['assigned_volunteers']))
                                <em style="color: #94a3b8;">No volunteers assigned</em>
                            @endif
                        </div>
                    </div>
                @endforeach
            </div>
        @endforeach
    </div>

    {{-- FOOTER: SYMBOLS, MEAL BREAKDOWN, VEHICLES --}}
    <div class="footer-section">
        <div class="footer-grid">
            <div class="footer-col">
                <h4>Symbols</h4>
                <ul>
                    <li>* new volunteer</li>
                    <li>~ driver</li>
                    <li>^/^a team leader</li>
                </ul>
            </div>

            <div class="footer-col">
                <h4>Meal Breakdown</h4>
                <p>Breakfast - {{ $ics->meal_breakfast }}</p>
                <p>Lunch - {{ $ics->meal_lunch }}</p>
                <p>Snacks - {{ $ics->meal_snacks }}</p>
            </div>

            <div class="footer-col">
                <div class="vehicle-box">
                    <h4>Vehicle Assignment</h4>
                    @foreach ($dashboard['vehicles'] as $vehicle)
                        <p>{{ $vehicle['team_name'] }} - {{ $vehicle['vehicle'] }}</p>
                    @endforeach
                </div>
            </div>
        </div>
    </div>
</body>
</html>

```

---

## 3. BACKEND: SHIFT-AWARE VOLUNTEER LOADING

The `RsvpResponse` already has `time_slot_id` which links to `TimeSlot.text` (e.g., "AM", "PM", "Full Day"). Leverage this in the dashboard resource:

### Updated IcsController: `getRsvpVolunteers` with shift info

```php
public function getRsvpVolunteers(int $rsvpId, Request $request): AnonymousResourceCollection|JsonResponse
{
    $rsvp = Rsvp::query()->find($rsvpId);

    if (! $rsvp) {
        return response()->json(['message' => 'RSVP not found.'], 404);
    }

    $query = Volunteer::query()
        ->whereHas('rsvpResponses', function ($q) use ($rsvpId) {
            $q->where('rsvp_id', $rsvpId);
        })
        ->with(['skills', 'positions', 'experiences']);

    // Filter by shift if requested
    $shift = $request->query('shift'); // 'am', 'pm', or null for all
    if ($shift) {
        $query->whereHas('rsvpResponses', function ($q) use ($rsvpId, $shift) {
            $q->where('rsvp_id', $rsvpId)
              ->whereHas('timeSlot', fn ($ts) => $ts->whereRaw('LOWER(text) LIKE ?', ['%' . strtolower($shift) . '%']));
        });
    }

    $volunteers = $query->get();

    // Append shift info to each volunteer
    $volunteers->each(function ($volunteer) use ($rsvpId) {
        $response = $volunteer->rsvpResponses()->where('rsvp_id', $rsvpId)->with('timeSlot')->first();
        $volunteer->setAttribute('shift', $response?->timeSlot?->text ?? 'Unknown');
    });

    return VolunteerResource::collection($volunteers);
}

```

### New Route for shift-filtered volunteers

```php
Route::get('/ics/{rsvpId}/rsvp-volunteers', [IcsController::class, 'getRsvpVolunteers']);
// Query param: ?shift=am or ?shift=pm

```

---

## 4. BACKEND: MOVE VOLUNTEER ENDPOINT

```php
// Add to IcsController.php

public function moveVolunteer(int $icsId, Request $request): JsonResponse
{
    $request->validate([
        'volunteer_id' => ['required', 'integer'],
        'from_team_id' => ['required', 'integer'],
        'to_team_id' => ['required', 'integer'],
        'role' => ['nullable', 'string'],
    ]);

    $ics = Ics::query()->find($icsId);

    if (! $ics) {
        return response()->json(['message' => 'ICS not found.'], 404);
    }

    DB::transaction(function () use ($ics, $request): void {
        // Update the pivot team_id
        $ics->volunteers()->updateExistingPivot($request->input('volunteer_id'), [
            'team_id' => $request->input('to_team_id'),
            'role' => $request->input('role', 'Team Member'),
        ]);
    });

    return response()->json(['message' => 'Volunteer moved successfully.']);
}

```

### Route

```php
Route::post('/ics/{id}/move-volunteer', [IcsController::class, 'moveVolunteer']);

```

---

## 5. BACKEND: UPDATE ICS METADATA

```php
// Already handled by the existing update() method in IcsController
// Just add new fields to UpdateIcsRequest:

// app/Http/Requests/UpdateIcsRequest.php
public function rules(): array
{
    return [
        'name' => ['sometimes', 'string', 'max:255'],
        'description' => ['sometimes', 'nullable', 'string'],
        'location' => ['sometimes', 'nullable', 'string'],
        'status' => ['sometimes', 'in:draft,active,completed'],
        'team_ids' => ['sometimes', 'array'],
        'team_ids.*' => ['integer', 'exists:teams,id'],
        'objective' => ['sometimes', 'nullable', 'integer', 'min:0'],
        'menu' => ['sometimes', 'nullable', 'string', 'max:255'],
        'meal_breakfast' => ['sometimes', 'integer', 'min:0'],
        'meal_lunch' => ['sometimes', 'integer', 'min:0'],
        'meal_snacks' => ['sometimes', 'integer', 'min:0'],
    ];
}

```

---

## 6. FRONTEND: ENHANCED COMPONENT (TypeScript)

### Updated `ics.ts` model — add new interfaces

```typescript
// Add to models/ics.ts

export interface IcsMetadata {
  objective: number | null;
  menu: string | null;
  meal_breakfast: number;
  meal_lunch: number;
  meal_snacks: number;
}

export interface MoveVolunteerRequest {
  volunteer_id: number;
  from_team_id: number;
  to_team_id: number;
  role?: string;
}

// Update IcsDashboard to include metadata
export interface IcsDashboard {
  ics_id: number;
  rsvp: {
    id: number;
    title: string;
    date: string;
    location: string | null;
  };
  metadata: IcsMetadata;           // NEW
  command_roles: IcsCommandRole[];
  branches: IcsDashboardBranch[];
  vehicles: IcsVehicleAssignment[];
}

```

### Updated `ics.service.ts` — add missing methods

```typescript
// Add to IcsService class:

/**
 * Move a volunteer between teams.
 */
moveVolunteer(icsId: number, body: MoveVolunteerRequest): Observable<{ message: string }> {
  return this.ensureCsrf().pipe(
    switchMap(() =>
      this.http.post<{ message: string }>(
        `${this.apiUrl}/${icsId}/move-volunteer`,
        body,
        { withCredentials: true },
      ),
    ),
  );
}

/**
 * Search volunteers from the RSVP pool (with optional shift filter).
 */
searchRsvpVolunteers(rsvpId: number, shift?: string): Observable<{ data: RsvpVolunteer[] }> {
  const params: Record<string, string> = {};
  if (shift) params['shift'] = shift;

  return this.http.get<{ data: RsvpVolunteer[] }>(
    `${this.apiUrl}/${rsvpId}/rsvp-volunteers`,
    { params, withCredentials: true },
  );
}

/**
 * Update ICS metadata (objective, menu, meal counts).
 */
updateMetadata(icsId: number, body: Partial<IcsMetadata>): Observable<{ data: Ics }> {
  return this.ensureCsrf().pipe(
    switchMap(() =>
      this.http.put<{ data: Ics }>(`${this.apiUrl}/${icsId}`, body, { withCredentials: true }),
    ),
  );
}

/**
 * Export ICS as PDF (returns blob).
 */
exportPdf(icsId: number): Observable<Blob> {
  return this.http.get(`${this.apiUrl}/${icsId}/export-pdf`, {
    responseType: 'blob',
    withCredentials: true,
  });
}

```

### Updated Component Logic (`incident-command-system.ts`)

```typescript
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, switchMap } from 'rxjs';
import { CustomSelect, SelectOption } from '../components/custom-select/custom-select';
import {
  AiCandidate,
  AiSuggestion,
  IcsCommandRole,
  IcsDashboard,
  IcsDashboardTeam,
  RsvpVolunteer,
} from '../models/ics';
import { Rsvp } from '../models/rsvp';
import { IcsService } from '../services/ics.service';
import { RsvpService } from '../services/rsvp.service';

const SECTION_CHIEF_KEYS = ['planning', 'purchasing', 'mwc_coordinator', 'safety_emergency'];
const BRANCH_DIRECTOR_KEYS = [
  'mobile_kitchen_director',
  'am_distribution_director',
  'pm_distribution_director',
];

@Component({
  selector: 'app-incident-command-system',
  templateUrl: './incident-command-system.html',
  styleUrl: './incident-command-system.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CustomSelect],
})
export class IncidentCommandSystemComponent implements OnInit {
  private readonly rsvpService = inject(RsvpService);
  private readonly icsService = inject(IcsService);

  // --- State Signals ---
  readonly rsvpOptions = signal<SelectOption<string>[]>([]);
  readonly selectedRsvp = signal<Rsvp | null>(null);
  readonly icsData = signal<IcsDashboard | null>(null);
  readonly aiSuggestions = signal<AiSuggestion[]>([]);
  readonly selectedSuggestionIds = signal<Set<number>>(new Set());
  readonly volunteerSearchByTeam = signal<Record<number, string>>({});
  readonly searchResultsByTeam = signal<Record<number, RsvpVolunteer[]>>({});
  readonly editingRoleKey = signal<string | null>(null);
  readonly roleDraft = signal('');
  readonly isLoading = signal(false);
  readonly isLoadingAiSuggestions = signal(false);
  readonly isApplyingAiSuggestions = signal(false);
  readonly isSuggestionsModalOpen = signal(false);
  readonly isExporting = signal(false);
  readonly error = signal<string | null>(null);
  readonly aiError = signal<string | null>(null);

  // Move volunteer state
  readonly movingVolunteer = signal<{ volunteerId: number; fromTeamId: number } | null>(null);

  // Metadata editing
  readonly isEditingMetadata = signal(false);
  readonly metadataDraft = signal({ objective: 0, menu: '', meal_breakfast: 0, meal_lunch: 0, meal_snacks: 0 });

  // --- Computed ---
  readonly selectedRsvpId = computed(() => this.selectedRsvp()?.id ?? null);
  readonly hasIcsData = computed(() => !!this.icsData());
  readonly sectionChiefRoles = computed(() => this.rolesByKeys(SECTION_CHIEF_KEYS));
  readonly branchDirectorRoles = computed(() => this.rolesByKeys(BRANCH_DIRECTOR_KEYS));
  readonly hasSelectedSuggestions = computed(() => this.selectedSuggestionIds().size > 0);

  readonly dashboardVolunteers = computed(() => {
    const dashboard = this.icsData();
    return dashboard?.branches.reduce(
      (total, branch) =>
        total + branch.teams.reduce((bt, team) => bt + team.assigned_volunteers.length, 0),
      0,
    ) ?? 0;
  });

  readonly allTeamsFlat = computed(() => {
    const dashboard = this.icsData();
    if (!dashboard) return [];
    return dashboard.branches.flatMap((b) => b.teams);
  });

  ngOnInit(): void {
    this.loadRsvpList();
  }

  // ===== RSVP & DASHBOARD =====

  loadRsvpList(): void {
    this.error.set(null);
    this.isLoading.set(true);

    this.rsvpService
      .getRsvps()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          const rsvps = response.data ?? [];
          this.rsvpOptions.set(rsvps.map((rsvp) => ({ label: rsvp.title, value: rsvp.id.toString() })));

          if (rsvps.length === 0) {
            this.error.set('No RSVP events found. Please create an RSVP event first.');
            return;
          }

          this.selectedRsvp.set(rsvps[0]);
          this.loadDashboard(rsvps[0].id);
        },
        error: () => this.error.set('Failed to load RSVP events.'),
      });
  }

  selectRsvp(rsvpId: number | string): void {
    const id = typeof rsvpId === 'string' ? Number.parseInt(rsvpId, 10) : rsvpId;
    if (Number.isNaN(id)) return;

    const option = this.rsvpOptions().find((rsvp) => Number(rsvp.value) === id);
    this.selectedRsvp.set(option ? ({ id, title: option.label } as Rsvp) : this.selectedRsvp());
    this.loadDashboard(id);
  }

  loadDashboard(rsvpId: number): void {
    this.error.set(null);
    this.isLoading.set(true);

    this.icsService
      .getDashboard(rsvpId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => this.icsData.set(response.data),
        error: () => this.error.set('Failed to load ICS dashboard.'),
      });
  }

  // ===== COMMAND ROLE EDITING =====

  roleByKey(key: string): IcsCommandRole | null {
    return this.icsData()?.command_roles.find((role) => role.key === key) ?? null;
  }

  editRole(role: IcsCommandRole): void {
    this.editingRoleKey.set(role.key);
    this.roleDraft.set(role.assigned_name ?? '');
  }

  cancelRoleEdit(): void {
    this.editingRoleKey.set(null);
    this.roleDraft.set('');
  }

  saveRole(role: IcsCommandRole): void {
    const dashboard = this.icsData();
    if (!dashboard) return;

    this.icsService
      .updateCommandRole(dashboard.ics_id, role.key, { assigned_name: this.roleDraft() })
      .subscribe({
        next: (response) => {
          this.icsData.set(response.data);
          this.cancelRoleEdit();
        },
        error: () => this.error.set('Failed to update command role.'),
      });
  }

  // ===== AI SUGGESTIONS =====

  generateAiSuggestions(): void {
    const dashboard = this.icsData();
    if (!dashboard) return;

    this.aiError.set(null);
    this.isLoadingAiSuggestions.set(true);

    this.icsService
      .getAiSuggestions(dashboard.ics_id)
      .pipe(finalize(() => this.isLoadingAiSuggestions.set(false)))
      .subscribe({
        next: (response) => {
          const suggestions = response.data ?? [];
          this.aiSuggestions.set(suggestions);
          this.selectedSuggestionIds.set(new Set(suggestions.map((s) => s.volunteer_id)));
          this.isSuggestionsModalOpen.set(true);
        },
        error: () => this.aiError.set('Failed to generate AI suggestions.'),
      });
  }

  acceptSuggestion(team: IcsDashboardTeam, candidate: AiCandidate): void {
    const dashboard = this.icsData();
    if (!dashboard) return;

    this.icsService
      .assignVolunteer(dashboard.ics_id, {
        volunteer_id: candidate.volunteer_id,
        team_id: team.id,
        role: candidate.role,
        is_leader: candidate.role.toLowerCase().includes('lead'),
      })
      .pipe(switchMap(() => this.icsService.getDashboard(dashboard.rsvp.id)))
      .subscribe({
        next: (response) => this.icsData.set(response.data),
        error: () => this.error.set('Failed to assign suggested volunteer.'),
      });
  }

  applySelected(): void {
    const dashboard = this.icsData();
    if (!dashboard || this.selectedSuggestionIds().size === 0) return;

    const selected = this.aiSuggestions().filter((s) =>
      this.selectedSuggestionIds().has(s.volunteer_id),
    );

    this.isApplyingAiSuggestions.set(true);

    this.icsService
      .applyAiSuggestions(dashboard.ics_id, selected)
      .pipe(
        switchMap(() => this.icsService.getDashboard(dashboard.rsvp.id)),
        finalize(() => this.isApplyingAiSuggestions.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.icsData.set(response.data);
          this.dismissSuggestions();
        },
        error: () => this.aiError.set('Failed to apply suggestions.'),
      });
  }

  applyAll(): void {
    this.selectedSuggestionIds.set(new Set(this.aiSuggestions().map((s) => s.volunteer_id)));
    this.applySelected();
  }

  toggleSuggestion(volunteerId: number): void {
    const current = new Set(this.selectedSuggestionIds());
    current.has(volunteerId) ? current.delete(volunteerId) : current.add(volunteerId);
    this.selectedSuggestionIds.set(current);
  }

  dismissSuggestions(): void {
    this.isSuggestionsModalOpen.set(false);
    this.aiSuggestions.set([]);
    this.selectedSuggestionIds.set(new Set());
    this.aiError.set(null);
  }

  // ===== MOVE VOLUNTEER (NEW) =====

  startMoveVolunteer(team: IcsDashboardTeam, volunteerId: number): void {
    this.movingVolunteer.set({ volunteerId, fromTeamId: team.id });
  }

  cancelMove(): void {
    this.movingVolunteer.set(null);
  }

  confirmMoveToTeam(targetTeam: IcsDashboardTeam): void {
    const dashboard = this.icsData();
    const moving = this.movingVolunteer();
    if (!dashboard || !moving) return;

    this.icsService
      .moveVolunteer(dashboard.ics_id, {
        volunteer_id: moving.volunteerId,
        from_team_id: moving.fromTeamId,
        to_team_id: targetTeam.id,
      })
      .pipe(switchMap(() => this.icsService.getDashboard(dashboard.rsvp.id)))
      .subscribe({
        next: (response) => {
          this.icsData.set(response.data);
          this.movingVolunteer.set(null);
        },
        error: () => this.error.set('Failed to move volunteer.'),
      });
  }

  // ===== ADD VOLUNTEER (NEW — MANUAL SEARCH) =====

  setVolunteerSearch(teamId: number, value: string): void {
    this.volunteerSearchByTeam.update((current) => ({ ...current, [teamId]: value }));
  }

  searchVolunteersForTeam(team: IcsDashboardTeam): void {
    const dashboard = this.icsData();
    const query = this.volunteerSearchByTeam()[team.id]?.trim();
    if (!dashboard || !query) return;

    // Determine shift filter based on branch
    const branch = dashboard.branches.find((b) => b.teams.some((t) => t.id === team.id));
    let shiftFilter: string | undefined;
    if (branch?.key === 'am_distribution') shiftFilter = 'am';
    else if (branch?.key === 'pm_distribution') shiftFilter = 'pm';

    this.icsService.searchRsvpVolunteers(dashboard.rsvp.id, shiftFilter).subscribe({
      next: (response) => {
        const filtered = (response.data ?? []).filter((v) => {
          const fullName = `${v.first_name} ${v.last_name}`.toLowerCase();
          return fullName.includes(query.toLowerCase());
        });
        this.searchResultsByTeam.update((current) => ({ ...current, [team.id]: filtered }));
      },
      error: () => this.error.set('Failed to search volunteers.'),
    });
  }

  assignSearchedVolunteer(team: IcsDashboardTeam, volunteer: RsvpVolunteer): void {
    const dashboard = this.icsData();
    if (!dashboard) return;

    this.icsService
      .assignVolunteer(dashboard.ics_id, {
        volunteer_id: volunteer.volunteer_id,
        team_id: team.id,
        role: 'Team Member',
      })
      .pipe(switchMap(() => this.icsService.getDashboard(dashboard.rsvp.id)))
      .subscribe({
        next: (response) => {
          this.icsData.set(response.data);
          this.searchResultsByTeam.update((c) => ({ ...c, [team.id]: [] }));
          this.setVolunteerSearch(team.id, '');
        },
        error: () => this.error.set('Failed to assign volunteer.'),
      });
  }

  // ===== REMOVE VOLUNTEER =====

  removeVolunteer(team: IcsDashboardTeam, volunteerId: number): void {
    const dashboard = this.icsData();
    if (!dashboard) return;

    this.icsService
      .removeVolunteer(dashboard.ics_id, volunteerId)
      .pipe(switchMap(() => this.icsService.getDashboard(dashboard.rsvp.id)))
      .subscribe({
        next: (response) => this.icsData.set(response.data),
        error: () => this.error.set(`Failed to remove volunteer from ${team.name}.`),
      });
  }

  // ===== PDF EXPORT (NEW) =====

  exportPdf(): void {
    const dashboard = this.icsData();
    if (!dashboard) return;

    this.isExporting.set(true);

    this.icsService
      .exportPdf(dashboard.ics_id)
      .pipe(finalize(() => this.isExporting.set(false)))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ICS_${dashboard.rsvp.title.replace(/\s+/g, '_')}_${dashboard.rsvp.date}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.error.set('Failed to export PDF.'),
      });
  }

  // ===== METADATA EDITING (NEW) =====

  startEditMetadata(): void {
    const d = this.icsData();
    if (!d) return;
    this.metadataDraft.set({
      objective: (d as any).metadata?.objective ?? 0,
      menu: (d as any).metadata?.menu ?? '',
      meal_breakfast: (d as any).metadata?.meal_breakfast ?? 0,
      meal_lunch: (d as any).metadata?.meal_lunch ?? 0,
      meal_snacks: (d as any).metadata?.meal_snacks ?? 0,
    });
    this.isEditingMetadata.set(true);
  }

  saveMetadata(): void {
    const dashboard = this.icsData();
    if (!dashboard) return;

    this.icsService.updateMetadata(dashboard.ics_id, this.metadataDraft()).subscribe({
      next: () => {
        this.isEditingMetadata.set(false);
        this.loadDashboard(dashboard.rsvp.id);
      },
      error: () => this.error.set('Failed to save metadata.'),
    });
  }

  // ===== UTILITIES =====

  confidenceClass(confidence: number): string {
    if (confidence >= 0.85) return 'confidence-high';
    if (confidence >= 0.6) return 'confidence-medium';
    return 'confidence-low';
  }

  private rolesByKeys(keys: string[]): IcsCommandRole[] {
    return keys
      .map((key) => this.roleByKey(key))
      .filter((role): role is IcsCommandRole => !!role);
  }
}

```

---

## 7. FRONTEND: ENHANCED TEMPLATE (HTML)

```html
<!-- incident-command-system.html -->
<section class="ics-container">
  <!-- HEADER -->
  <header class="report-header">
    <div class="report-header-left">
      <div class="report-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <div class="report-title-group">
        <span class="report-label">Operational Dashboard</span>
        <h2 class="report-title">Incident Command System</h2>
      </div>
    </div>
    <div class="report-header-right">
      <button
        type="button"
        class="action-btn secondary"
        [disabled]="!hasIcsData() || isExporting()"
        (click)="exportPdf()">
        @if (isExporting()) {
          <span class="btn-spinner" aria-hidden="true"></span>
          <span>Exporting...</span>
        } @else {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          <span>Export PDF</span>
        }
      </button>
      <button
        type="button"
        class="action-btn"
        [disabled]="!hasIcsData() || isLoadingAiSuggestions()"
        (click)="generateAiSuggestions()">
        @if (isLoadingAiSuggestions()) {
          <span class="btn-spinner" aria-hidden="true"></span>
          <span>Generating...</span>
        } @else {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
            <path d="M12 2a4 4 0 014 4c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2a4 4 0 014-4z"/>
            <path d="M9 12h6M9 16h6M12 8v12"/>
          </svg>
          <span>AI Suggestions</span>
        }
      </button>
    </div>
  </header>
  <!-- ERROR -->
  @if (error()) {
    <div class="error-message">
      <div class="error-content"><span>{{ error() }}</span></div>
      <button class="action-btn secondary btn-sm" type="button" (click)="loadRsvpList()">Retry</button>
    </div>
  }
  <!-- RSVP SELECTOR -->
  @if (rsvpOptions().length > 0) {
    <div class="rsvp-selector-container">
      <label class="filter-label">Target RSVP Event</label>
      <app-custom-select
        [options]="rsvpOptions()"
        [value]="selectedRsvpId()?.toString() || ''"
        (valueChange)="selectRsvp($event)"
        variant="volunteer">
      </app-custom-select>
    </div>
  }
  <!-- LOADING / EMPTY -->
  @if (isLoading()) {
    <div class="ics-empty-state">
      <span class="btn-spinner dark" aria-hidden="true"></span>
      <h3>Loading ICS dashboard</h3>
    </div>
  } @else if (!hasIcsData()) {
    <div class="ics-empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
      <h3>No ICS dashboard loaded</h3>
      <p>Select an RSVP event to initialize the operational dashboard.</p>
    </div>
  } @else {
    <!-- SUMMARY GRID -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="card-content">
          <span class="label">RSVP Event</span>
          <span class="value">{{ icsData()!.rsvp.title }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-content">
          <span class="label">Date</span>
          <span class="value">{{ icsData()!.rsvp.date }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-content">
          <span class="label">Location</span>
          <span class="value">{{ icsData()!.rsvp.location || 'Not set' }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-content">
          <span class="label">Assigned Volunteers</span>
          <span class="value highlight">{{ dashboardVolunteers() }}</span>
        </div>
      </div>
    </div>
    <!-- COMMAND STRUCTURE (ORG CHART) -->
    <section class="hierarchy-section" aria-labelledby="org-chart-title">
      <h3 id="org-chart-title" class="section-title">Command Structure</h3>
      <div class="org-chart">
        <!-- Level 1: Responsible Official -->
        @if (roleByKey('responsible_official'); as role) {
          <div class="org-level org-level--center">
            <article class="org-node org-node--root">
              <div class="org-node__role">{{ role.title }}</div>
              @if (editingRoleKey() === role.key) {
                <div class="org-node__edit-row">
                  <input class="edit-input" type="text" [ngModel]="roleDraft()" (ngModelChange)="roleDraft.set($event)" (keyup.enter)="saveRole(role)" />
                  <button class="sym-btn active" type="button" (click)="saveRole(role)">✓</button>
                  <button class="sym-btn" type="button" (click)="cancelRoleEdit()">✕</button>
                </div>
              } @else {
                <div class="org-node__name">{{ role.assigned_name || 'Unassigned' }}</div>
                <button class="org-node__edit" type="button" (click)="editRole(role)" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              }
            </article>
          </div>
        }
        <div class="org-connector org-connector--v"></div>
        <!-- Level 2: Incident Commander -->
        @if (roleByKey('incident_commander'); as role) {
          <div class="org-level org-level--center">
            <article class="org-node org-node--commander">
              <div class="org-node__role">{{ role.title }}</div>
              @if (editingRoleKey() === role.key) {
                <div class="org-node__edit-row">
                  <input class="edit-input" type="text" [ngModel]="roleDraft()" (ngModelChange)="roleDraft.set($event)" (keyup.enter)="saveRole(role)" />
                  <button class="sym-btn active" type="button" (click)="saveRole(role)">✓</button>
                  <button class="sym-btn" type="button" (click)="cancelRoleEdit()">✕</button>
                </div>
              } @else {
                <div class="org-node__name">{{ role.assigned_name || 'Unassigned' }}</div>
                <button class="org-node__edit" type="button" (click)="editRole(role)" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              }
            </article>
          </div>
        }
        <div class="org-connector org-connector--v"></div>
        <!-- Level 3: Section Chiefs -->
        <div class="org-level org-level--chiefs">
          @for (role of sectionChiefRoles(); track role.key) {
            <article class="org-node org-node--chief">
              <div class="org-node__role">{{ role.title }}</div>
              @if (editingRoleKey() === role.key) {
                <div class="org-node__edit-row">
                  <input class="edit-input" type="text" [ngModel]="roleDraft()" (ngModelChange)="roleDraft.set($event)" (keyup.enter)="saveRole(role)" />
                  <button class="sym-btn active" type="button" (click)="saveRole(role)">✓</button>
                  <button class="sym-btn" type="button" (click)="cancelRoleEdit()">✕</button>
                </div>
              } @else {
                <div class="org-node__name">{{ role.assigned_name || 'Unassigned' }}</div>
                <button class="org-node__edit" type="button" (click)="editRole(role)" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              }
            </article>
          }
        </div>
        <div class="org-connector org-connector--v"></div>
        <!-- Level 4: Branch Directors -->
        <div class="org-level org-level--branches">
          @for (role of branchDirectorRoles(); track role.key) {
            <article class="org-node org-node--branch">
              <div class="org-node__role">{{ role.title }}</div>
              @if (editingRoleKey() === role.key) {
                <div class="org-node__edit-row">
                  <input class="edit-input" type="text" [ngModel]="roleDraft()" (ngModelChange)="roleDraft.set($event)" (keyup.enter)="saveRole(role)" />
                  <button class="sym-btn active" type="button" (click)="saveRole(role)">✓</button>
                  <button class="sym-btn" type="button" (click)="cancelRoleEdit()">✕</button>
                </div>
              } @else {
                <div class="org-node__name">{{ role.assigned_name || 'Unassigned' }}</div>
                <button class="org-node__edit" type="button" (click)="editRole(role)" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              }
            </article>
          }
        </div>
      </div>
    </section>

    <!-- OPERATIONAL TEAMS (Kanban Board) -->
    <section class="ops-section" aria-label="Operational teams">
      <!-- MOVE MODE BANNER -->
      @if (movingVolunteer()) {
        <div class="move-banner">
          <span>Select a team to move the volunteer to</span>
          <button class="action-btn secondary btn-sm" type="button" (click)="cancelMove()">Cancel</button>
        </div>
      }
      @for (branch of icsData()!.branches; track branch.key) {
        <section class="ops-column">
          <header class="ops-header">
            <div class="header-info">
              <h3>{{ branch.title }}</h3>
            </div>
            <span class="team-count">{{ branch.teams.length }} teams</span>
          </header>
          <div class="ops-content">
            @for (team of branch.teams; track team.key) {
              <article class="team-card" [class.move-target]="movingVolunteer() && movingVolunteer()!.fromTeamId !== team.id"
                       (click)="movingVolunteer() && movingVolunteer()!.fromTeamId !== team.id ? confirmMoveToTeam(team) : null">
                <header class="team-card__header">
                  <span class="team-card__title">{{ team.name }}</span>
                  @if (team.vehicle) {
                    <span class="team-card__vehicle">{{ team.vehicle }}</span>
                  }
                </header>
                <div class="team-card__body">
                  <!-- ASSIGNED VOLUNTEERS -->
                  @if (team.assigned_volunteers.length === 0) {
                    <p class="team-card__empty">No assigned volunteers yet.</p>
                  }
                  @for (volunteer of team.assigned_volunteers; track volunteer.id) {
                    <div class="vol-row">
                      <div class="vol-tag" [class.is-driver]="volunteer.is_driver" [class.is-leader]="volunteer.is_leader">
                        <span class="vol-tag__name">{{ volunteer.name }}</span>
                        @if (volunteer.is_leader) {
                          <span class="vol-badge leader">Lead</span>
                        }
                        @if (volunteer.is_driver) {
                          <span class="vol-badge driver">Driver</span>
                        }
                        <div class="vol-tag__actions">
                          <button class="sym-btn" type="button" (click)="startMoveVolunteer(team, volunteer.id)" title="Move to another team">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                          </button>
                          <button class="sym-btn sym-btn--danger" type="button" (click)="removeVolunteer(team, volunteer.id)" title="Remove">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                  <!-- AI SUGGESTION BLOCK -->
                  @if (team.ai_suggestion && team.ai_suggestion.candidates.length > 0) {
                    <div class="ai-suggestion-block">
                      <div class="ai-suggestion-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                          <path d="M12 2a4 4 0 014 4c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2a4 4 0 014-4z"/>
                          <path d="M12 8v12M9 12h6M9 16h6"/>
                        </svg>
                        <span>AI Suggestion</span>
                      </div>
                      <ul class="ai-rationale">
                        @for (line of team.ai_suggestion.rationale; track $index) {
                          <li>{{ line }}</li>
                        }
                      </ul>
                      <div class="ai-candidates">
                        <span class="try-label">Try:</span>
                        @for (candidate of team.ai_suggestion.candidates; track candidate.volunteer_id) {
                          <button class="candidate-pill" type="button" (click)="acceptSuggestion(team, candidate)">
                            {{ candidate.name }}
                            <span class="pill-confidence" [class]="confidenceClass(candidate.confidence)">
                              {{ (candidate.confidence * 100) | number: '1.0-0' }}%
                            </span>
                          </button>
                        }
                      </div>
                    </div>
                  }
                  <!-- ADD VOLUNTEER SEARCH -->
                  <div class="add-volunteer-row">
                    <input
                      type="text"
                      class="add-volunteer-input"
                      placeholder="Search volunteer..."
                      [value]="volunteerSearchByTeam()[team.id] || ''"
                      (input)="setVolunteerSearch(team.id, $any($event.target).value)"
                      (keyup.enter)="searchVolunteersForTeam(team)" />
                    <button class="sym-btn" type="button" (click)="searchVolunteersForTeam(team)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    </button>
                  </div>
                  <!-- SEARCH RESULTS DROPDOWN -->
                  @if (searchResultsByTeam()[team.id]?.length) {
                    <div class="search-results-dropdown">
                      @for (vol of searchResultsByTeam()[team.id]!; track vol.volunteer_id) {
                        <button class="search-result-item" type="button" (click)="assignSearchedVolunteer(team, vol)">
                          <span class="sr-name">{{ vol.first_name }} {{ vol.last_name }}</span>
                          <span class="sr-skills">{{ vol.skills.slice(0, 2).join(', ') }}</span>
                        </button>
                      }
                    </div>
                  }
                </div>
              </article>
            }
          </div>
        </section>
      }
    </section>

    <!-- VEHICLE ASSIGNMENTS -->
    @if (icsData()!.vehicles.length > 0) {
      <section class="vehicles-section">
        <h3 class="section-title">Vehicle Assignments</h3>
        <div class="vehicles-grid">
          @for (v of icsData()!.vehicles; track v.team_key) {
            <div class="vehicle-chip">
              <span class="vehicle-team">{{ v.team_name }}</span>
              <span class="vehicle-name">{{ v.vehicle }}</span>
            </div>
          }
        </div>
      </section>
    }

    <!-- LEGEND -->
    <section class="legend-section">
      <div class="legend-grid">
        <div class="legend-item"><span class="vol-badge leader">Lead</span> Team Leader</div>
        <div class="legend-item"><span class="vol-badge driver">Driver</span> Assigned Driver</div>
        <div class="legend-item"><span class="vol-badge new">New</span> New Volunteer</div>
      </div>
    </section>
  }

  <!-- AI SUGGESTIONS MODAL -->
  @if (isSuggestionsModalOpen()) {
    <div class="modal-overlay" (click)="dismissSuggestions()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <header class="modal-header">
          <h3>AI Team Assignment Suggestions</h3>
          <button class="sym-btn" type="button" (click)="dismissSuggestions()">✕</button>
        </header>
        @if (aiError()) {
          <div class="error-message" style="margin: 1rem;">{{ aiError() }}</div>
        }

        <div class="modal-body">
          <table class="suggestions-table">
            <thead>
              <tr>
                <th><input type="checkbox" [checked]="hasSelectedSuggestions()" (change)="applyAll()" /></th>
                <th>Volunteer</th>
                <th>Team</th>
                <th>Role</th>
                <th>Confidence</th>
                <th>Reasoning</th>
              </tr>
            </thead>
            <tbody>
              @for (suggestion of aiSuggestions(); track suggestion.volunteer_id) {
                <tr>
                  <td><input type="checkbox" [checked]="selectedSuggestionIds().has(suggestion.volunteer_id)" (change)="toggleSuggestion(suggestion.volunteer_id)" /></td>
                  <td class="cell-name">{{ suggestion.volunteer_name }}</td>
                  <td>{{ suggestion.team_name }}</td>
                  <td>{{ suggestion.role }}</td>
                  <td>
                    <span class="confidence-badge" [class]="confidenceClass(suggestion.confidence)">
                      {{ (suggestion.confidence * 100) | number: '1.0-0' }}%
                    </span>
                  </td>
                  <td class="cell-reasoning">{{ suggestion.reasoning || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <footer class="modal-footer">
          <button class="action-btn secondary" type="button" (click)="dismissSuggestions()">Dismiss</button>
          <button class="action-btn" type="button" [disabled]="!hasSelectedSuggestions() || isApplyingAiSuggestions()" (click)="applySelected()">
            @if (isApplyingAiSuggestions()) {
              <span class="btn-spinner" aria-hidden="true"></span> Applying...
            } @else {
              Apply Selected ({{ selectedSuggestionIds().size }})
            }
          </button>
          <button class="action-btn" type="button" [disabled]="isApplyingAiSuggestions()" (click)="applyAll()">Apply All</button>
        </footer>
      </div>
    </div>
  }
</section>

```

---

## 8. FRONTEND: ENHANCED STYLES (SCSS Additions)

```scss
// Add to incident-command-system.scss

// === MOVE MODE ===
.move-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #92400e;
  grid-column: 1 / -1;
}

.team-card.move-target {
  cursor: pointer;
  border: 2px dashed $primary;
  background: #eff6ff;
  transition: all 0.2s ease;

  &:hover {
    background: #dbeafe;
    transform: scale(1.01);
  }
}

// === AI SUGGESTION BLOCK ===
.ai-suggestion-block {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
}

.ai-suggestion-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #0369a1;
  margin-bottom: 0.5rem;
}

.ai-rationale {
  list-style: none;
  padding: 0;
  margin: 0 0 0.5rem;

  li {
    font-size: 0.75rem;
    color: #475569;
    padding-left: 0.75rem;
    position: relative;
    margin-bottom: 2px;

    &::before {
      content: '•';
      position: absolute;
      left: 0;
      color: #0ea5e9;
    }
  }
}

.ai-candidates {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}

.try-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #0369a1;
  text-transform: uppercase;
}

.candidate-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  background: white;
  border: 1px solid #0ea5e9;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #0369a1;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #0ea5e9;
    color: white;

    .pill-confidence { color: white; opacity: 0.8; }
  }
}

.pill-confidence {
  font-size: 0.625rem;
  font-weight: 700;

  &.confidence-high { color: #059669; }
  &.confidence-medium { color: #d97706; }
  &.confidence-low { color: #dc2626; }
}

// === ADD VOLUNTEER ===
.add-volunteer-row {
  display: flex;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed #e2e8f0;
}

.add-volunteer-input {
  flex: 1;
  padding: 0.375rem 0.625rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.75rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px rgba($primary, 0.1);
  }

  &::placeholder { color: #94a3b8; }
}

.search-results-dropdown {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  box-shadow: $shadow-md;
  margin-top: 4px;
  max-height: 150px;
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.75rem;
  text-align: left;
  transition: background 0.15s;

  &:hover { background: #f1f5f9; }

  .sr-name { font-weight: 600; color: $text-main; }
  .sr-skills { font-size: 0.675rem; color: $text-muted; }
}

// === VOLUNTEER BADGES ===
.vol-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.025em;

  &.leader { background: #dbeafe; color: #1d4ed8; }
  &.driver { background: #fef3c7; color: #92400e; }
  &.new { background: #d1fae5; color: #065f46; }
}

// === VEHICLES SECTION ===
.vehicles-section {
  background: white;
  border-radius: $radius;
  border: 2px solid #d97706;
  padding: 1.5rem;
}

.vehicles-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.vehicle-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 8px;

  .vehicle-team { font-weight: 700; font-size: 0.8125rem; color: $text-main; }
  .vehicle-name { font-size: 0.8125rem; color: #92400e; }
}

// === LEGEND ===
.legend-section {
  padding: 1rem;
  background: #f8fafc;
  border-radius: $radius;
  border: 1px solid $border-color;
}

.legend-grid {
  display: flex;
  gap: 1.5rem;
  font-size: 0.8125rem;
  color: $text-muted;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

// === MODAL ===
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fade-in 0.2s ease-out;
}

.modal-content {
  background: white;
  border-radius: $radius;
  width: 90%;
  max-width: 900px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: $shadow-lg;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid $border-color;

  h3 { font-size: 1.125rem; font-weight: 700; color: $text-main; margin: 0; }
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid $border-color;
}

.suggestions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;

  th, td { padding: 0.625rem 0.75rem; text-align: left; border-bottom: 1px solid #f1f5f9; }
  th { font-weight: 700; font-size: 0.75rem; text-transform: uppercase; color: $text-muted; background: #f8fafc; }
  .cell-name { font-weight: 600; }
  .cell-reasoning { max-width: 200px; font-size: 0.75rem; color: $text-muted; }
}

.confidence-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 0.7rem;
  font-weight: 700;

  &.confidence-high { background: #d1fae5; color: #065f46; }
  &.confidence-medium { background: #fef3c7; color: #92400e; }
  &.confidence-low { background: #fee2e2; color: #991b1b; }
}

// === ORG NODE EDIT BUTTON (pencil icon on hover) ===
.org-node {
  position: relative;

  &__edit {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;

    svg { width: 14px; height: 14px; color: $primary; }

    &:hover { background: #eff6ff; }
  }

  &:hover .org-node__edit { opacity: 1; }

  &__edit-row {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-top: 4px;
  }
}

.edit-input {
  padding: 0.25rem 0.5rem;
  border: 1px solid $primary;
  border-radius: 4px;
  font-size: 0.8125rem;
  width: 120px;

  &:focus { outline: none; box-shadow: 0 0 0 2px rgba($primary, 0.2); }
}

// === BTN SPINNER ===
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;

  &.dark {
    border-color: rgba(0, 0, 0, 0.1);
    border-top-color: $primary;
    width: 24px;
    height: 24px;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// === RESPONSIVE ===
@media (max-width: 1024px) {
  .ops-section { grid-template-columns: 1fr; }
  .org-level--chiefs, .org-level--branches { flex-wrap: wrap; justify-content: center; }
}

.btn-icon {
  width: 16px;
  height: 16px;
}

```

---

## 9. KEY ARCHITECTURE DECISIONS (Defense Talking Points)

| Decision | Rationale |
| --- | --- |
| **Signal-based state** | Angular 21 best practice; fine-grained reactivity without RxJS overhead in templates |
| **OnPush change detection** | Performance: only re-renders when signals change |
| **Dashboard auto-creation** | `firstOrCreate` pattern — admin visits once, ICS is seeded from RSVP data |
| **Shift-aware filtering** | Volunteers who chose AM time slot are auto-suggested for AM Distribution teams |
| **Groq + fallback** | AI primary, but always works offline via hardcoded skill-team mapping |
| **PDF via DomPDF** | Matches exact client format (the paper document in the image); eliminates manual editing |
| **Command roles in separate table** | Decouples org chart from operational teams; enables history tracking |
| **Move volunteer via pivot update** | Single DB operation, no delete+create race conditions |

---

## 10. ROUTES SUMMARY

```php
// routes/api.php (ICS group)
Route::prefix('ics')->group(function () {
    Route::get('/', [IcsController::class, 'index']);
    Route::post('/', [IcsController::class, 'store']);
    Route::get('/dashboard', [IcsController::class, 'dashboard']);
    Route::get('/{id}', [IcsController::class, 'show']);
    Route::put('/{id}', [IcsController::class, 'update']);
    Route::delete('/{id}', [IcsController::class, 'destroy']);
    Route::patch('/{id}/command-roles/{roleKey}', [IcsController::class, 'updateCommandRole']);
    Route::get('/{rsvpId}/rsvp-volunteers', [IcsController::class, 'getRsvpVolunteers']);
    Route::get('/{id}/ai-suggestions', [IcsController::class, 'getAiSuggestions']);
    Route::post('/{id}/apply-suggestions', [IcsController::class, 'applyAiSuggestions']);
    Route::post('/{id}/assign-volunteer', [IcsController::class, 'assignVolunteer']);
    Route::post('/{id}/remove-volunteer', [IcsController::class, 'removeVolunteer']);
    Route::post('/{id}/move-volunteer', [IcsController::class, 'moveVolunteer']);       // NEW
    Route::get('/{id}/export-pdf', [IcsController::class, 'exportPdf']);               // NEW
});

```

