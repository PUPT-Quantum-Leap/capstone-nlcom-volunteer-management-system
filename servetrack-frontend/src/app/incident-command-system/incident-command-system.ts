import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, switchMap } from 'rxjs';
import { CustomSelect, SelectOption } from '../components/custom-select/custom-select';
import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
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
  readonly metadataDraft = signal({
    objective: null as number | null,
    menu: '',
    meal_breakfast: 0,
    meal_lunch: 0,
    meal_snacks: 0,
  });

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
        error: () => this.error.set('Failed to load RSVP events. Check if backend is running.'),
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
        error: () => this.error.set('Failed to load ICS dashboard. Please try again.'),
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
        error: () => this.aiError.set('Failed to generate AI suggestions. Please try again.'),
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
        error: () => this.aiError.set('Failed to apply suggestions. Please try again.'),
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

  // ===== MOVE VOLUNTEER =====

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

  // ===== ADD VOLUNTEER (MANUAL SEARCH) =====

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

  // ===== PDF EXPORT =====

  exportPdf(): void {
    const dashboard = this.icsData();
    if (!dashboard) return;

    this.isExporting.set(true);

    try {
      this.generateIcsPdf(dashboard);
    } catch (e) {
      console.error('PDF export failed:', e);
      this.error.set('Failed to export PDF.');
    } finally {
      this.isExporting.set(false);
    }
  }

  private generateIcsPdf(dashboard: IcsDashboard): void {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 40;
    let y = 36;

    // --- HEADER ---
    pdf.setFontSize(15);
    pdf.setFont('helvetica', 'bold');
    pdf.text('MOBILE KITCHEN OPERATIONS', pageWidth / 2, y, { align: 'center' });
    y += 20;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const meta = dashboard.metadata;
    const totalVols = dashboard.branches.reduce(
      (t, b) => t + b.teams.reduce((bt, team) => bt + team.assigned_volunteers.length, 0), 0,
    );
    pdf.text(`OBJECTIVE: ${meta.objective ?? 'N/A'}    MENU: ${meta.menu || 'N/A'}`, margin, y);
    pdf.text(`DATE: ${dashboard.rsvp.date}    VOLUNTEERS: ${totalVols}`, pageWidth - margin, y, { align: 'right' });
    y += 16;
    pdf.setDrawColor(30, 58, 95);
    pdf.setLineWidth(1.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 20;

    // --- ORG CHART ---
    const roles = new Map(dashboard.command_roles.map((r) => [r.key, r]));
    const drawNode = (x: number, nodeY: number, role: string, name: string, w = 140): number => {
      pdf.setDrawColor(30, 41, 59);
      pdf.setLineWidth(0.75);
      pdf.rect(x - w / 2, nodeY, w, 28);
      pdf.setFontSize(6.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(37, 99, 235);
      pdf.text(role.toUpperCase(), x, nodeY + 10, { align: 'center' });
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 41, 59);
      pdf.text(name || 'Unassigned', x, nodeY + 22, { align: 'center' });
      return nodeY + 28;
    };

    const cx = pageWidth / 2;
    // Level 1
    y = drawNode(cx, y, 'Responsible Official', roles.get('responsible_official')?.assigned_name ?? '');
    y += 8;
    // Level 2
    y = drawNode(cx, y, 'Incident Commander', roles.get('incident_commander')?.assigned_name ?? '');
    y += 8;
    // Level 3 - Section Chiefs
    const chiefKeys = ['planning', 'purchasing', 'mwc_coordinator', 'safety_emergency'];
    const chiefWidth = 120;
    const chiefGap = 8;
    const totalChiefWidth = chiefKeys.length * chiefWidth + (chiefKeys.length - 1) * chiefGap;
    let chiefX = cx - totalChiefWidth / 2 + chiefWidth / 2;
    const chiefY = y;
    for (const key of chiefKeys) {
      const role = roles.get(key);
      drawNode(chiefX, chiefY, role?.title ?? key, role?.assigned_name ?? '', chiefWidth);
      chiefX += chiefWidth + chiefGap;
    }
    y = chiefY + 36;

    // --- OPERATIONAL BRANCHES (as tables) ---
    for (const branch of dashboard.branches) {
      y += 10;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text(branch.title.toUpperCase(), margin, y);
      y += 4;

      // Director
      const dirKey = branch.key === 'mobile_kitchen' ? 'mobile_kitchen_director'
        : branch.key === 'am_distribution' ? 'am_distribution_director'
        : 'pm_distribution_director';
      const director = roles.get(dirKey);
      if (director?.assigned_name) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Director: ${director.assigned_name}`, margin, y + 10);
        y += 6;
      }

      const tableRows: RowInput[] = branch.teams.map((team) => {
        const volNames = team.assigned_volunteers.map((v) => {
          let name = v.name;
          if (v.is_leader) name += '^';
          if (v.is_driver) name += '~';
          return name;
        }).join(', ') || '—';
        return [
          team.name + (team.vehicle ? ` (${team.vehicle})` : ''),
          volNames,
        ];
      });

      autoTable(pdf, {
        startY: y + 4,
        margin: { left: margin, right: margin },
        theme: 'grid',
        head: [['Team', 'Assigned Volunteers']],
        body: tableRows,
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 4,
          lineColor: [30, 41, 59],
          lineWidth: 0.5,
          textColor: [30, 41, 59],
          valign: 'top',
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [241, 245, 249],
          fontStyle: 'bold',
          halign: 'center',
          textColor: [30, 41, 59],
        },
        columnStyles: {
          0: { cellWidth: 120, fontStyle: 'bold' },
          1: { cellWidth: pageWidth - margin * 2 - 120 },
        },
      });

      y = (pdf as any).lastAutoTable.finalY + 6;
    }

    // --- FOOTER: SYMBOLS + MEAL BREAKDOWN + VEHICLES ---
    y += 12;
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 14;

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('SYMBOLS', margin, y);
    pdf.text('MEAL BREAKDOWN', margin + 150, y);
    pdf.text('VEHICLE ASSIGNMENT', margin + 310, y);
    y += 12;

    pdf.setFont('helvetica', 'normal');
    pdf.text('^ team leader    ~ driver    * new volunteer', margin, y);
    pdf.text(`Breakfast: ${meta.meal_breakfast}   Lunch: ${meta.meal_lunch}   Snacks: ${meta.meal_snacks}`, margin + 150, y);

    const vehicleLines = dashboard.vehicles.map((v) => `${v.team_name} - ${v.vehicle}`).join('   ');
    if (vehicleLines) {
      pdf.text(vehicleLines, margin + 310, y);
    }

    // --- SAVE ---
    const filename = `ICS_${dashboard.rsvp.title.replace(/\s+/g, '_')}_${dashboard.rsvp.date}.pdf`;
    pdf.save(filename);
  }

  // ===== METADATA EDITING =====

  startEditMetadata(): void {
    const dashboard = this.icsData();
    if (!dashboard) return;
    this.metadataDraft.set({
      objective: dashboard.metadata.objective ?? null,
      menu: dashboard.metadata.menu ?? '',
      meal_breakfast: dashboard.metadata.meal_breakfast ?? 0,
      meal_lunch: dashboard.metadata.meal_lunch ?? 0,
      meal_snacks: dashboard.metadata.meal_snacks ?? 0,
    });
    this.isEditingMetadata.set(true);
  }

  cancelEditMetadata(): void {
    this.isEditingMetadata.set(false);
  }

  saveMetadata(): void {
    const dashboard = this.icsData();
    if (!dashboard) return;

    this.icsService.updateMetadata(dashboard.ics_id, this.metadataDraft()).subscribe({
      next: () => {
        this.isEditingMetadata.set(false);
        this.loadDashboard(dashboard.rsvp.id);
      },
      error: () => this.error.set('Failed to save operation details.'),
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
