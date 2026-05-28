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

  readonly rsvpOptions = signal<SelectOption<string>[]>([]);
  readonly selectedRsvp = signal<Rsvp | null>(null);
  readonly icsData = signal<IcsDashboard | null>(null);
  readonly aiSuggestions = signal<AiSuggestion[]>([]);
  readonly selectedSuggestionIds = signal<Set<number>>(new Set());
  readonly volunteerSearchByTeam = signal<Record<number, string>>({});
  readonly editingRoleKey = signal<string | null>(null);
  readonly roleDraft = signal('');
  readonly isLoading = signal(false);
  readonly isLoadingAiSuggestions = signal(false);
  readonly isApplyingAiSuggestions = signal(false);
  readonly isSuggestionsModalOpen = signal(false);
  readonly error = signal<string | null>(null);
  readonly aiError = signal<string | null>(null);

  readonly selectedRsvpId = computed(() => this.selectedRsvp()?.id ?? null);
  readonly hasIcsData = computed(() => !!this.icsData());
  readonly sectionChiefRoles = computed(() => this.rolesByKeys(SECTION_CHIEF_KEYS));
  readonly branchDirectorRoles = computed(() => this.rolesByKeys(BRANCH_DIRECTOR_KEYS));
  readonly hasSelectedSuggestions = computed(() => this.selectedSuggestionIds().size > 0);
  readonly dashboardVolunteers = computed(() => {
    const dashboard = this.icsData();

    return dashboard?.branches.reduce(
      (total, branch) =>
        total +
        branch.teams.reduce((branchTotal, team) => branchTotal + team.assigned_volunteers.length, 0),
      0,
    ) ?? 0;
  });

  ngOnInit(): void {
    this.loadRsvpList();
  }

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
        error: () => this.error.set('Failed to load RSVP events. Check if backend is running.'),
      });
  }

  selectRsvp(rsvpId: number | string): void {
    const id = typeof rsvpId === 'string' ? Number.parseInt(rsvpId, 10) : rsvpId;

    if (Number.isNaN(id)) {
      return;
    }

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
        error: () => this.error.set('Failed to load ICS dashboard. Please try again.'),
      });
  }

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

    if (!dashboard) {
      return;
    }

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

  generateAiSuggestions(): void {
    const dashboard = this.icsData();

    if (!dashboard) {
      return;
    }

    this.aiError.set(null);
    this.isLoadingAiSuggestions.set(true);

    this.icsService
      .getAiSuggestions(dashboard.ics_id)
      .pipe(finalize(() => this.isLoadingAiSuggestions.set(false)))
      .subscribe({
        next: (response) => {
          const suggestions = response.data ?? [];
          this.aiSuggestions.set(suggestions);
          this.selectedSuggestionIds.set(new Set(suggestions.map((suggestion) => suggestion.volunteer_id)));
          this.isSuggestionsModalOpen.set(true);
        },
        error: () => this.aiError.set('Failed to generate AI suggestions. Please try again.'),
      });
  }

  acceptSuggestion(team: IcsDashboardTeam, candidate: AiCandidate): void {
    const dashboard = this.icsData();

    if (!dashboard) {
      return;
    }

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

    if (!dashboard || this.selectedSuggestionIds().size === 0) {
      return;
    }

    const selected = this.aiSuggestions().filter((suggestion) =>
      this.selectedSuggestionIds().has(suggestion.volunteer_id),
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
        error: () => this.aiError.set('Failed to apply suggestions. Please try again.'),
      });
  }

  applyAll(): void {
    this.selectedSuggestionIds.set(new Set(this.aiSuggestions().map((suggestion) => suggestion.volunteer_id)));
    this.applySelected();
  }

  toggleSuggestion(volunteerId: number): void {
    const current = new Set(this.selectedSuggestionIds());

    if (current.has(volunteerId)) {
      current.delete(volunteerId);
    } else {
      current.add(volunteerId);
    }

    this.selectedSuggestionIds.set(current);
  }

  dismissSuggestions(): void {
    this.isSuggestionsModalOpen.set(false);
    this.aiSuggestions.set([]);
    this.selectedSuggestionIds.set(new Set());
    this.aiError.set(null);
  }

  removeVolunteer(team: IcsDashboardTeam, volunteerId: number): void {
    const dashboard = this.icsData();

    if (!dashboard) {
      return;
    }

    this.icsService
      .removeVolunteer(dashboard.ics_id, volunteerId)
      .pipe(switchMap(() => this.icsService.getDashboard(dashboard.rsvp.id)))
      .subscribe({
        next: (response) => this.icsData.set(response.data),
        error: () => this.error.set(`Failed to remove volunteer from ${team.name}.`),
      });
  }

  moveVolunteer(team: IcsDashboardTeam, volunteerId: number): void {
    this.error.set(`Move volunteer ${volunteerId} from ${team.name} is not wired yet.`);
  }

  setVolunteerSearch(teamId: number, value: string): void {
    this.volunteerSearchByTeam.update((current) => ({ ...current, [teamId]: value }));
  }

  addVolunteer(team: IcsDashboardTeam): void {
    const query = this.volunteerSearchByTeam()[team.id]?.trim();

    if (!query) {
      return;
    }

    this.error.set('Manual volunteer search selection is not wired yet. Use AI suggestions for assignment.');
  }

  confidenceClass(confidence: number): string {
    if (confidence >= 0.85) {
      return 'confidence-high';
    }

    if (confidence >= 0.6) {
      return 'confidence-medium';
    }

    return 'confidence-low';
  }

  private rolesByKeys(keys: string[]): IcsCommandRole[] {
    return keys
      .map((key) => this.roleByKey(key))
      .filter((role): role is IcsCommandRole => !!role);
  }
}
