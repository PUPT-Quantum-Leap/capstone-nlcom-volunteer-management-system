import { ChangeDetectionStrategy, Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RsvpService } from '../services/rsvp.service';
import { IcsService } from '../services/ics.service';
import { Rsvp } from '../models/rsvp';
import { AiSuggestion, Ics, CommandRoleNode, AssignedVolunteer, TeamCard, BranchColumn } from '../models/ics';
import { CustomSelect, SelectOption } from '../components/custom-select/custom-select';

export interface Volunteer {
  name: string;
  isNew: boolean;
  isDriver: boolean;
  isLeader: boolean;
  // AI Metadata
  age?: number;
  attendance?: string;
  skills?: string[];
  training?: string[];
  department?: string;
  rationale?: string;
  alternatives?: string[];
}

export interface Team {
  name: string;
  volunteers: Volunteer[];
  aiSuggestions?: AiSuggestion[]; // AI suggestions for this team from backend
}

export interface OperationalColumn {
  title: string;
  leader: string;
  teams: Team[];
}

export interface MealBreakdown {
  breakfast: number;
  lunch: number;
  snacks: number;
}

export interface VehicleAssignment {
  code: string;
  vehicle: string;
}

export interface CommandRole {
  role: string;
  name: string;
}

@Component({
  selector: 'app-incident-command-system',
  templateUrl: './incident-command-system.html',
  styleUrl: './incident-command-system.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CustomSelect],
})
export class IncidentCommandSystemComponent implements OnInit {
  private rsvpService = inject(RsvpService);
  private icsService = inject(IcsService);

  // Dropdown Options
  rsvpOptions = signal<SelectOption<string>[]>([]);

  // Edit mode state
  isEditMode = false;
  isLoading = false;
  error: string | null = null;

  // AI suggestions state
  aiSuggestions = signal<AiSuggestion[]>([]);
  selectedSuggestionIds = signal<Set<number>>(new Set());
  isLoadingAiSuggestions = signal(false);
  isApplyingAiSuggestions = signal(false);
  aiError = signal<string | null>(null);
  isSuggestionsModalOpen = signal(false);
  currentIcsId = signal<number | null>(null);
  hasIcsData = signal(false);

  hasSelectedSuggestions = computed(() => this.selectedSuggestionIds().size > 0);
  canGenerateAiSuggestions = computed(
    () => !!this.selectedRsvp() && (this.selectedRsvp()!.totalResponses ?? 0) > 0,
  );
  generateButtonTooltip = computed(() => {
    if (!this.selectedRsvp()) {
      return 'Select an RSVP event first.';
    }
    if ((this.selectedRsvp()!.totalResponses ?? 0) === 0) {
      return 'No volunteers have RSVP\'d for this event yet.';
    }
    return 'Generate AI-powered team assignments.';
  });

  // Backend data
  rsvpList: Rsvp[] = [];
  selectedRsvp = signal<Rsvp | null>(null);

  // Header Information - Connected to backend
  objective = 0;
  menu = '';
  date = '';
  volunteers = 0;

  // RSVP ID to link with (passed via route or selected)
  rsvpId: number | null = null;

  // Command Hierarchy - Start empty
  responsibleOfficial: CommandRole = { role: 'Responsible Official', name: '' };
  incidentCommander: CommandRole = { role: 'Incident Commander', name: '' };
  pio: CommandRole = { role: 'Public Information Officer', name: '' };
  liaisonOfficer: CommandRole = { role: 'Liaison Officer', name: '' };
  safetyOfficer: CommandRole = { role: 'Safety Officer', name: '' };
  planning: CommandRole = { role: 'Planning', name: '' };
  purchasing: CommandRole = { role: 'Purchasing', name: '' };
  mwcCoordinator: CommandRole = { role: 'MWC Coordinator', name: '' };
  safetyEmergency: CommandRole = { role: 'Safety & Emergency', name: '' };

  // Operational Columns - Start empty
  mobileKitchen: OperationalColumn = { title: '', leader: '', teams: [] };
  amDistribution: OperationalColumn = { title: '', leader: '', teams: [] };
  pmDistribution: OperationalColumn = { title: '', leader: '', teams: [] };

  // Meal Breakdown - Start empty
  mealBreakdown: MealBreakdown = { breakfast: 0, lunch: 0, snacks: 0 };

  // Vehicle Assignments - Start empty
  vehicleAssignments: VehicleAssignment[] = [];

  // Helper to get clean name without symbols
  getCleanName(name: string): string {
    return name.replace(/[\*\~\^]/g, '');
  }

  /**
   * Formats AI suggestion reasoning for display
   */
  formatAiSuggestionReasoning(suggestion: AiSuggestion): string {
    if (suggestion.reasoning) {
      return suggestion.reasoning;
    }
    // Fallback: generate from available data
    const confidence = Math.round(suggestion.confidence * 100);
    const skills = suggestion.skills?.join(', ') || 'N/A';
    return `• Confidence: ${confidence}%\n• Skills: ${skills}\n• Role: ${suggestion.role}`;
  }

  /**
   * Gets the confidence percentage for a suggestion
   */
  getConfidencePercentage(suggestion: AiSuggestion): number {
    return Math.round(suggestion.confidence * 100);
  }

  // New volunteer input for adding to teams
  newVolunteerName = '';
  mobileKitchenNewVolunteer = '';
  amDistributionNewVolunteer = '';
  pmDistributionNewVolunteer = '';
  selectedColumn: 'mobileKitchen' | 'amDistribution' | 'pmDistribution' | null = null;
  selectedTeamIndex = -1;

  // Edit mode for new values
  newObjective = '';
  newMenu = '';
  newDate = '';

  // Hover state for AI suggestions
  hoveredVolunteer: Volunteer | CommandRole | null = null;
  hoveredRole = '';

  setHoveredVolunteer(volunteer: Volunteer | CommandRole, role: string): void {
    if (!this.isEditMode) {
      this.hoveredVolunteer = volunteer;
      this.hoveredRole = role;
    }
  }

  clearHover(): void {
    this.hoveredVolunteer = null;
    this.hoveredRole = '';
  }

  // Generate AI Rationale Mock
  generateRationale(v: Volunteer | CommandRole, role: string): string {
    // Handle CommandRole (Leadership nodes)
    if ('role' in v) {
      if (v.role === 'Responsible Official') return '• Senior leadership with verified oversight experience\n• Historical success in large-scale incident management';
      if (v.role === 'Incident Commander') return '• Expert in field coordination and team management\n• High-stress resilience and decision-making skills';
      return '• Specialized leadership with certified expertise\n• Deep institutional knowledge in assigned domain';
    }

    const skills = v.skills || ['General Ops'];
    const attendance = v.attendance || '95%';
    const training = v.training || ['Basic Safety'];
    
    return `• Exceptional ${attendance} attendance record
• Expert in ${skills.join(', ')}
• Certified in ${training.join(', ')}
• ${v.age}-year veteran with deep experience in ${v.department || 'Operations'}`;
  }

  getAlternatives(role: string): string[] {
    const allNames = ['Mark S.', 'Elena R.', 'David K.', 'Sarah J.', 'Tom H.', 'Lisa M.'];
    // Return 2 random names that aren't the current one (simplified)
    return allNames.sort(() => 0.5 - Math.random()).slice(0, 2);
  }

  toggleEditMode(): void {
    if (this.isEditMode) {
      // Save changes - update the actual values
      if (this.newObjective) {
        this.objective = parseInt(this.newObjective, 10) || this.objective;
      }
      if (this.newMenu) {
        this.menu = this.newMenu;
      }
      if (this.newDate) {
        this.date = this.newDate;
      }
    } else {
      // Enter edit mode - initialize new values
      this.newObjective = this.objective.toString();
      this.newMenu = this.menu;
      this.newDate = this.date;
    }
    this.isEditMode = !this.isEditMode;
  }

  // Volunteer management
  /**
   * Assigns a volunteer from an AI suggestion to a team
   * Called when user clicks "Try" button on AI suggestion
   */
  assignFromSuggestion(
    columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution',
    teamIndex: number,
    suggestion: AiSuggestion,
  ): void {
    if (!this.currentIcsId()) {
      this.error = 'No ICS event selected.';
      return;
    }

    const column = this.getColumn(columnKey);
    if (!column || !column.teams[teamIndex]) {
      console.error('[ICS] Invalid team reference');
      return;
    }

    const team = column.teams[teamIndex];

    // Call backend API to assign volunteer
    this.icsService.assignVolunteer(this.currentIcsId()!, {
      volunteer_id: suggestion.volunteer_id,
      team_id: suggestion.team_id,
      role: suggestion.role,
    }).subscribe({
      next: (response) => {
        console.log('[ICS] Volunteer assigned successfully', response);
        // Add or update volunteer in the team
        const existingIndex = team.volunteers.findIndex(v => v.name === suggestion.volunteer_name);
        if (existingIndex >= 0) {
          // Update existing volunteer
          team.volunteers[existingIndex] = {
            ...team.volunteers[existingIndex],
            name: suggestion.volunteer_name,
            skills: suggestion.skills,
          };
        } else {
          // Add new volunteer
          team.volunteers.push({
            name: suggestion.volunteer_name,
            isNew: false,
            isDriver: false,
            isLeader: suggestion.role === 'Leader' || suggestion.role === 'Team Leader',
            skills: suggestion.skills,
            training: [],
            department: '',
          });
        }
        this.updateVolunteerCount();
      },
      error: (error) => {
        console.error('[ICS] Failed to assign volunteer:', error);
        this.error = 'Failed to assign volunteer. Please try again.';
      },
    });
  }

  swapVolunteer(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number, volunteerIndex: number, newName: string): void {
    const column = this.getColumn(columnKey);
    if (column && column.teams[teamIndex] && column.teams[teamIndex].volunteers[volunteerIndex]) {
      const oldVolunteer = column.teams[teamIndex].volunteers[volunteerIndex];
      column.teams[teamIndex].volunteers[volunteerIndex] = {
        ...oldVolunteer,
        name: newName,
        // Reset metadata to trigger new rationale for the new person
        age: Math.floor(Math.random() * 25) + 20,
        attendance: (Math.floor(Math.random() * 20) + 80) + '%',
        skills: ['Ops', 'Coordination'],
        training: ['Basic Safety'],
        department: 'Ops'
      };
    }
  }

  addVolunteer(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number): void {
    const volunteerName = this.getVolunteerNameForColumn(columnKey);
    if (volunteerName.trim()) {
      const column = this.getColumn(columnKey);
      if (column && column.teams[teamIndex]) {
        column.teams[teamIndex].volunteers.push({
          name: volunteerName.trim(),
          isNew: false,
          isDriver: false,
          isLeader: false
        });
        this.clearVolunteerNameForColumn(columnKey);
        this.updateVolunteerCount();
      }
    }
  }

  removeVolunteer(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number, volunteerIndex: number): void {
    const column = this.getColumn(columnKey);
    if (column && column.teams[teamIndex]) {
      column.teams[teamIndex].volunteers.splice(volunteerIndex, 1);
      this.updateVolunteerCount();
    }
  }

  toggleNewVolunteer(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number, volunteerIndex: number): void {
    const column = this.getColumn(columnKey);
    if (column && column.teams[teamIndex] && column.teams[teamIndex].volunteers[volunteerIndex]) {
      column.teams[teamIndex].volunteers[volunteerIndex].isNew = !column.teams[teamIndex].volunteers[volunteerIndex].isNew;
    }
  }

  toggleDriver(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number, volunteerIndex: number): void {
    const column = this.getColumn(columnKey);
    if (column && column.teams[teamIndex] && column.teams[teamIndex].volunteers[volunteerIndex]) {
      column.teams[teamIndex].volunteers[volunteerIndex].isDriver = !column.teams[teamIndex].volunteers[volunteerIndex].isDriver;
    }
  }

  toggleLeader(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number, volunteerIndex: number): void {
    const column = this.getColumn(columnKey);
    if (column && column.teams[teamIndex] && column.teams[teamIndex].volunteers[volunteerIndex]) {
      column.teams[teamIndex].volunteers[volunteerIndex].isLeader = !column.teams[teamIndex].volunteers[volunteerIndex].isLeader;
    }
  }

  private getColumn(key: 'mobileKitchen' | 'amDistribution' | 'pmDistribution'): OperationalColumn | null {
    switch (key) {
      case 'mobileKitchen': return this.mobileKitchen;
      case 'amDistribution': return this.amDistribution;
      case 'pmDistribution': return this.pmDistribution;
      default: return null;
    }
  }

  private updateVolunteerCount(): void {
    let count = 0;
    this.mobileKitchen.teams.forEach(team => count += team.volunteers.length);
    this.amDistribution.teams.forEach(team => count += team.volunteers.length);
    this.pmDistribution.teams.forEach(team => count += team.volunteers.length);
    this.volunteers = count;
  }

  // Team management
  addTeam(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution'): void {
    const column = this.getColumn(columnKey);
    if (column) {
      column.teams.push({ name: 'New Team', volunteers: [] });
    }
  }

  removeTeam(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number): void {
    const column = this.getColumn(columnKey);
    if (column && column.teams[teamIndex]) {
      column.teams.splice(teamIndex, 1);
      this.updateVolunteerCount();
    }
  }

  // Vehicle management
  addVehicle(): void {
    this.vehicleAssignments.push({ code: 'New', vehicle: 'Vehicle' });
  }

  removeVehicle(index: number): void {
    this.vehicleAssignments.splice(index, 1);
  }

  // Symbol display helper - applies symbols properly
  getVolunteerSymbols(volunteer: Volunteer): string {
    let symbols = '';
    if (volunteer.isNew) symbols += '*';
    if (volunteer.isDriver) symbols += '~';
    if (volunteer.isLeader) symbols += '^';
    return symbols;
  }

  // Get display name with symbols after
  getDisplayName(volunteer: Volunteer): string {
    const cleanName = volunteer.name.replace(/[\*\~\^]/g, '');
    return cleanName;
  }

  // Get all operational columns for template iteration
  getOperationalColumns(): OperationalColumn[] {
    return [this.mobileKitchen, this.amDistribution, this.pmDistribution];
  }

  // Helper methods for volunteer name management
  private getVolunteerNameForColumn(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution'): string {
    switch (columnKey) {
      case 'mobileKitchen': return this.mobileKitchenNewVolunteer;
      case 'amDistribution': return this.amDistributionNewVolunteer;
      case 'pmDistribution': return this.pmDistributionNewVolunteer;
      default: return '';
    }
  }

  private clearVolunteerNameForColumn(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution'): void {
    switch (columnKey) {
      case 'mobileKitchen': this.mobileKitchenNewVolunteer = ''; break;
      case 'amDistribution': this.amDistributionNewVolunteer = ''; break;
      case 'pmDistribution': this.pmDistributionNewVolunteer = ''; break;
    }
  }

  // Get column key for template
  getColumnKey(column: OperationalColumn): string {
    if (column === this.mobileKitchen) return 'mobileKitchen';
    if (column === this.amDistribution) return 'amDistribution';
    if (column === this.pmDistribution) return 'pmDistribution';
    return '';
  }

  // Export to PDF - placeholder
  exportToPdf(): void {
    // Will be implemented later
    console.log('Export to PDF clicked');
  }

  // Export to Excel - placeholder
  exportToExcel(): void {
    // Will be implemented later
    console.log('Export to Excel clicked');
  }

  generateAiSuggestions(): void {
    if (!this.selectedRsvp() || !this.canGenerateAiSuggestions()) {
      return;
    }

    this.isLoadingAiSuggestions.set(true);
    this.aiError.set(null);

    const rsvp = this.selectedRsvp()!;

    this.icsService.createIcs({ rsvp_id: rsvp.id, name: rsvp.title }).subscribe({
      next: (icsResponse) => {
        const icsId = icsResponse.data.id;
        this.currentIcsId.set(icsId);

        this.icsService.getAiSuggestions(icsId).subscribe({
          next: (suggestionsResponse) => {
            const suggestions = (suggestionsResponse.data ?? []) as AiSuggestion[];
            this.aiSuggestions.set(suggestions);
            this.selectedSuggestionIds.set(new Set(suggestions.map((s) => s.volunteer_id)));
            this.isLoadingAiSuggestions.set(false);
            this.isSuggestionsModalOpen.set(true);
          },
          error: () => {
            this.aiError.set('Failed to generate AI suggestions. Please try again.');
            this.isLoadingAiSuggestions.set(false);
          },
        });
      },
      error: () => {
        this.aiError.set('Failed to initialize ICS. Please try again.');
        this.isLoadingAiSuggestions.set(false);
      },
    });
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

  applySelected(): void {
    const icsId = this.currentIcsId();
    if (!icsId) {
      return;
    }

    const selected = this.aiSuggestions().filter((s) =>
      this.selectedSuggestionIds().has(s.volunteer_id),
    );

    if (selected.length === 0) {
      return;
    }

    this.isApplyingAiSuggestions.set(true);

    this.icsService
      .applyAiSuggestions(icsId, selected)
      .subscribe({
        next: (response: { data: Ics }) => {
          this.isApplyingAiSuggestions.set(false);
          this.isSuggestionsModalOpen.set(false);
          this.aiSuggestions.set([]);
          if (response?.data) {
            this.populateFromIcsData(response.data);
            this.hasIcsData.set(true);
          }
        },
        error: () => {
          this.aiError.set('Failed to apply suggestions. Please try again.');
          this.isApplyingAiSuggestions.set(false);
        },
      });
  }

  applyAll(): void {
    this.selectedSuggestionIds.set(new Set(this.aiSuggestions().map((s) => s.volunteer_id)));
    this.applySelected();
  }

  dismissSuggestions(): void {
    this.isSuggestionsModalOpen.set(false);
    this.aiSuggestions.set([]);
    this.aiError.set(null);
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

  // Generate New ICS - populates all data including RSVP header and volunteer teams
  generateNewICS(): void {
    if (this.selectedRsvp()) {
      // Display the RSVP header data
      this.mapRsvpToComponent(this.selectedRsvp()!);
      // Populate the sample volunteer and team data
      this.populateSampleData();
      console.log('Generated ICS with data from:', this.selectedRsvp()!.title);
    } else {
      // Clear all fields if no RSVP selected
      this.clearAllData();
      console.log('Generated blank ICS - no RSVP selected');
    }
  }

  // Populate sample volunteer and team data
  private populateSampleData(): void {
    // Command Hierarchy
    this.responsibleOfficial = { role: 'Responsible Official', name: 'Paul Giague' };
    this.incidentCommander = { role: 'Incident Commander', name: 'Catherine Tolentino' };
    this.planning = { role: 'Planning', name: 'Heidi Glague' };
    this.purchasing = { role: 'Purchasing', name: 'Stephanie Tan' };
    this.mwcCoordinator = { role: 'MWC Coordinator', name: 'Kevin Tabares' };
    this.safetyEmergency = { role: 'Safety & Emergency', name: 'Sam Omberga' };

    // Mobile Kitchen
    this.mobileKitchen = {
      title: 'Mobile Kitchen',
      leader: 'Elisa Aguipo^',
      teams: [
        { 
          name: 'KITCHEN TRUCK', 
          volunteers: [
            { name: 'Miah', isNew: false, isDriver: false, isLeader: false, age: 24, attendance: '98%', skills: ['Cooking', 'Inventory'], training: ['Food Safety'], department: 'Logistics' },
            { name: 'Jones', isNew: false, isDriver: false, isLeader: false, age: 29, attendance: '92%', skills: ['Heavy Lifting'], training: ['Safety 101'], department: 'Ops' },
            { name: 'Sam', isNew: false, isDriver: false, isLeader: false, age: 22, attendance: '85%', skills: ['Cleaning'], training: ['Basic Hygiene'], department: 'Ops' },
            { name: 'Rice: Blessing', isNew: false, isDriver: false, isLeader: false, age: 27, attendance: '100%', skills: ['Coordination'], training: ['Leadership'], department: 'Admin' }
          ] 
        },
        { 
          name: 'FOOD PREP', 
          volunteers: [
            { name: 'Teresa^', isNew: false, isDriver: false, isLeader: true, age: 35, attendance: '96%', skills: ['Culinary Arts'], training: ['Advanced Food Safety'], department: 'Logistics' },
            { name: 'Cath^a', isNew: false, isDriver: false, isLeader: false, age: 31, attendance: '90%', skills: ['Prep Work'], training: ['Hygiene Cert'], department: 'Logistics' },
            { name: 'Natasya', isNew: false, isDriver: false, isLeader: false, age: 23, attendance: '88%', skills: ['Speed Cutting'], training: ['Safety 101'], department: 'Ops' },
            { name: 'Michay', isNew: false, isDriver: false, isLeader: false, age: 26, attendance: '94%', skills: ['Organization'], training: ['Food Safety'], department: 'Ops' },
            { name: 'Aly', isNew: false, isDriver: false, isLeader: false, age: 24, attendance: '91%', skills: ['Sanitization'], training: ['Basic Safety'], department: 'Ops' },
            { name: 'Evenmae', isNew: false, isDriver: false, isLeader: false, age: 25, attendance: '93%', skills: ['Plating'], training: ['Food Safety'], department: 'Logistics' }
          ] 
        },
        { 
          name: 'VOLUNTEER CARE', 
          volunteers: [
            { name: 'Myrrh^', isNew: false, isDriver: false, isLeader: true, age: 33, attendance: '99%', skills: ['First Aid', 'Counseling'], training: ['Advanced Safety'], department: 'Care' },
            { name: 'Rhia^a', isNew: false, isDriver: false, isLeader: false, age: 28, attendance: '95%', skills: ['Communication'], training: ['First Aid'], department: 'Care' },
            { name: 'Lady', isNew: false, isDriver: false, isLeader: false, age: 26, attendance: '87%', skills: ['Hospitality'], training: ['Basic Safety'], department: 'Ops' }
          ] 
        },
        { 
          name: 'WASH / CLEAN UP', 
          volunteers: [
            { name: 'Orly^', isNew: false, isDriver: false, isLeader: false, age: 40, attendance: '97%', skills: ['Sanitization'], training: ['Chemical Handling'], department: 'Ops' },
            { name: 'John', isNew: false, isDriver: false, isLeader: false, age: 22, attendance: '84%', skills: ['Labor'], training: ['Basic Safety'], department: 'Ops' },
            { name: 'Daniel', isNew: false, isDriver: false, isLeader: false, age: 23, attendance: '89%', skills: ['Labor'], training: ['Basic Safety'], department: 'Ops' },
            { name: 'Ariel', isNew: false, isDriver: false, isLeader: false, age: 25, attendance: '92%', skills: ['Labor'], training: ['Basic Safety'], department: 'Ops' }
          ] 
        },
        { 
          name: 'INVENTORY', 
          volunteers: [
            { name: 'Beth^', isNew: false, isDriver: false, isLeader: false, age: 38, attendance: '100%', skills: ['Audit', 'XLS'], training: ['Logistics Management'], department: 'Logistics' },
            { name: 'Nestor', isNew: false, isDriver: false, isLeader: false, age: 42, attendance: '95%', skills: ['Warehousing'], training: ['Safety 101'], department: 'Logistics' },
            { name: 'Johan (pm)', isNew: false, isDriver: false, isLeader: false, age: 30, attendance: '91%', skills: ['Stock Control'], training: ['Basic Safety'], department: 'Ops' }
          ] 
        },
      ]
    };

    // AM Distribution
    this.amDistribution = {
      title: 'AM DISTRIBUTION',
      leader: 'Steph Tan',
      teams: [
        { name: 'TEAM ALPHA (PYP/GANNET)', volunteers: [{ name: 'Kevin~', isNew: false, isDriver: true, isLeader: false, age: 32, attendance: '98%', skills: ['Driving', 'Nav'], training: ['Advanced Driving'], department: 'Logistics' }] },
        { name: 'TEAM BRAVO (MX/NBN)', volunteers: [{ name: 'John~', isNew: false, isDriver: true, isLeader: false, age: 34, attendance: '96%', skills: ['Driving'], training: ['Defensive Driving'], department: 'Logistics' }, { name: 'Blessing', isNew: false, isDriver: false, isLeader: false, age: 27, attendance: '100%', skills: ['Coordination'], training: ['Leadership'], department: 'Admin' }, { name: 'Natasya', isNew: false, isDriver: false, isLeader: false, age: 23, attendance: '88%', skills: ['Speed Cutting'], training: ['Safety 101'], department: 'Ops' }, { name: 'Jhay2', isNew: false, isDriver: false, isLeader: false, age: 25, attendance: '90%', skills: ['Ops'], training: ['Basic Safety'], department: 'Ops' }, { name: 'Evenmae', isNew: false, isDriver: false, isLeader: false, age: 25, attendance: '93%', skills: ['Plating'], training: ['Food Safety'], department: 'Logistics' }] },
        { name: 'TEAM CHARLIE1 (MASVILLE)', volunteers: [{ name: 'Sam~', isNew: false, isDriver: true, isLeader: false, age: 29, attendance: '94%', skills: ['Driving'], training: ['Basic Safety'], department: 'Logistics' }, { name: 'Michay^', isNew: false, isDriver: false, isLeader: true, age: 26, attendance: '94%', skills: ['Organization'], training: ['Food Safety'], department: 'Ops' }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false, age: 24, attendance: '91%', skills: ['Sanitization'], training: ['Basic Safety'], department: 'Ops' }] },
        { name: 'TEAM CHARLIE2 (BANAJ)', volunteers: [{ name: 'Orly~', isNew: false, isDriver: true, isLeader: false, age: 40, attendance: '97%', skills: ['Driving'], training: ['Chemical Handling'], department: 'Ops' }, { name: 'Daniel', isNew: false, isDriver: false, isLeader: false, age: 23, attendance: '89%', skills: ['Labor'], training: ['Basic Safety'], department: 'Ops' }, { name: 'Rhia', isNew: false, isDriver: false, isLeader: false, age: 28, attendance: '95%', skills: ['Communication'], training: ['First Aid'], department: 'Care' }] },
      ]
    };

    // PM Distribution
    this.pmDistribution = {
      title: 'PM DISTRIBUTION',
      leader: 'Steph Tan',
      teams: [
        { name: 'TEAM DELTA1 (SITIO P)', volunteers: [{ name: 'Cedie~', isNew: false, isDriver: true, isLeader: false, age: 28, attendance: '93%', skills: ['Driving'], training: ['Basic Safety'], department: 'Logistics' }, { name: 'Lady~', isNew: false, isDriver: true, isLeader: false, age: 26, attendance: '87%', skills: ['Driving'], training: ['Basic Safety'], department: 'Ops' }] },
        { name: 'TEAM DELTA2 (SUCAT H)', volunteers: [{ name: 'Michael S~', isNew: false, isDriver: true, isLeader: false, age: 31, attendance: '95%', skills: ['Driving'], training: ['Advanced Driving'], department: 'Logistics' }, { name: 'Karl', isNew: false, isDriver: false, isLeader: false, age: 24, attendance: '90%', skills: ['Ops'], training: ['Basic Safety'], department: 'Ops' }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false, age: 24, attendance: '91%', skills: ['Sanitization'], training: ['Basic Safety'], department: 'Ops' }] },
        { name: 'TEAM ECHO (DELPAN)', volunteers: [{ name: 'John~', isNew: false, isDriver: true, isLeader: false, age: 34, attendance: '96%', skills: ['Driving'], training: ['Defensive Driving'], department: 'Logistics' }, { name: 'Cath^', isNew: false, isDriver: false, isLeader: true, age: 31, attendance: '90%', skills: ['Coordination'], training: ['Hygiene Cert'], department: 'Logistics' }, { name: 'Johan', isNew: false, isDriver: false, isLeader: false, age: 30, attendance: '91%', skills: ['Stock Control'], training: ['Basic Safety'], department: 'Ops' }] },
        { name: 'TEAM FOXTROT (PAR/SUN)', volunteers: [] },
      ]
    };

    // Meal Breakdown
    this.mealBreakdown = { breakfast: 40, lunch: 50, snacks: 50 };

    // Vehicle Assignments
    this.vehicleAssignments = [
      { code: 'Alpha', vehicle: 'Flexi' },
      { code: 'Bravo', vehicle: 'Hilux' },
      { code: 'Charlie 1', vehicle: 'Clipper' },
      { code: 'Charlie 2', vehicle: 'Chevy' },
      { code: 'Delta 1', vehicle: 'Hilux' },
      { code: 'Delta 2', vehicle: 'Black' },
      { code: 'Echo', vehicle: 'Chevy' },
      { code: 'Foxtrot', vehicle: 'Flexi/Clipper' },
    ];
  }

  // Clear all data
  private clearAllData(): void {
    this.objective = 0;
    this.menu = '';
    this.date = '';
    this.volunteers = 0;
    this.responsibleOfficial = { role: 'Responsible Official', name: '' };
    this.incidentCommander = { role: 'Incident Commander', name: '' };
    this.planning = { role: 'Planning', name: '' };
    this.purchasing = { role: 'Purchasing', name: '' };
    this.mwcCoordinator = { role: 'MWC Coordinator', name: '' };
    this.safetyEmergency = { role: 'Safety & Emergency', name: '' };
    this.mobileKitchen = { title: '', leader: '', teams: [] };
    this.amDistribution = { title: '', leader: '', teams: [] };
    this.pmDistribution = { title: '', leader: '', teams: [] };
    this.mealBreakdown = { breakfast: 0, lunch: 0, snacks: 0 };
    this.vehicleAssignments = [];
  }

  // Backend Connection Methods
  ngOnInit(): void {
    // Load RSVP list only, don't auto-load data
    this.loadRsvpList();
  }

  /**
   * Load list of RSVP events from backend.
   */
  loadRsvpList(): void {
    this.error = null;

    this.rsvpService.getRsvps().subscribe({
      next: (response) => {
        console.log('RSVP list loaded:', response);
        this.rsvpList = response.data || [];
        this.rsvpOptions.set(this.rsvpList.map(r => ({ label: r.title, value: r.id.toString() })));

        if (this.rsvpList.length === 0) {
          this.error = 'No RSVP events found. Please create an RSVP event first.';
        } else {
          // Select first RSVP but DON'T display data yet
          this.selectedRsvp.set(this.rsvpList[0]);
          this.rsvpId = this.rsvpList[0].id;
          console.log('Selected RSVP (data not displayed yet):', this.selectedRsvp()!.title);
        }
      },
      error: (err) => {
        this.error = 'Failed to load RSVP events. Check if backend is running.';
        console.error('Error loading RSVP list:', err);
      },
    });
  }

  /**
   * Load RSVP data and populate ICS fields.
   */
  loadRsvpData(rsvpId: number): void {
    this.isLoading = true;
    this.rsvpId = rsvpId;
    this.error = null;

    this.rsvpService.getRsvpById(rsvpId).subscribe({
      next: (response) => {
        console.log('RSVP data loaded:', response);
        this.selectedRsvp.set(response.data);
        this.mapRsvpToComponent(response.data);
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load RSVP data. Check if backend is running.';
        this.isLoading = false;
        console.error('Error loading RSVP:', err);
      },
    });
  }

  /**
   * Select a different RSVP event - only stores selection, doesn't display data yet.
   */
  selectRsvp(rsvpId: number | string): void {
    const id = typeof rsvpId === 'string' ? parseInt(rsvpId, 10) : rsvpId;
    if (!isNaN(id)) {
      const found = this.rsvpList.find(r => r.id === id);
      if (found) {
        this.selectedRsvp.set(found);
        this.rsvpId = id;
        this.loadExistingIcsForRsvp(id);
      }
    }
  }

  private loadExistingIcsForRsvp(rsvpId: number): void {
    this.hasIcsData.set(false);
    this.clearAllData();

    this.icsService.getIcs().subscribe({
      next: (response) => {
        const existing = response.data?.find((ics: any) => ics.rsvp_id === rsvpId);
        if (existing?.volunteers?.length) {
          this.currentIcsId.set(existing.id);
          this.populateFromIcsData(existing);
          this.hasIcsData.set(true);
        }
      },
      error: () => {},
    });
  }

  /**
   * Map RSVP data to component properties.
   */
  private mapRsvpToComponent(rsvp: Rsvp): void {
    console.log('Mapping RSVP data:', rsvp);

    // DATE from RSVP date
    this.date = rsvp.date
      ? new Date(rsvp.date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

    // VOLUNTEERS count from RSVP responses
    this.volunteers = rsvp.totalResponses || 0;

    // OBJECTIVE - use responses count as target/objective for now
    // Can be customized later based on RSVP title or a separate field
    this.objective = rsvp.totalResponses || 0;

    // MENU - extract from title or description
    // For now, use title as menu indicator
    this.menu = rsvp.title || rsvp.description || '';

    console.log('Mapped values:', {
      date: this.date,
      volunteers: this.volunteers,
      objective: this.objective,
      menu: this.menu,
      totalResponses: rsvp.totalResponses,
    });
  }

  /**
   * Populates ICS data from backend response
   * Handles command roles, branches with teams, volunteers, AI suggestions, and vehicles
   */
  private populateFromIcsData(ics: any): void {
    if (!ics) {
      console.warn('[ICS] No ICS data to populate');
      return;
    }

    try {
      // Load command roles from backend
      this.loadCommandRoles(ics);

      // Load branches with teams and volunteers from backend
      this.loadBranchesAndTeams(ics);

      // Load vehicles from backend
      this.loadVehicles(ics);

      // Update volunteer count
      this.updateVolunteerCount();

      // Mark that ICS data is loaded
      this.hasIcsData.set(true);

      console.log('[ICS] Data populated successfully', {
        commandRoles: {
          responsibleOfficial: this.responsibleOfficial,
          incidentCommander: this.incidentCommander,
          sectionChiefs: [this.planning, this.purchasing, this.mwcCoordinator, this.safetyEmergency],
        },
        branches: [this.mobileKitchen, this.amDistribution, this.pmDistribution],
        vehicles: this.vehicleAssignments,
      });
    } catch (error) {
      console.error('[ICS] Error populating data:', error);
      this.error = 'Failed to load ICS data. Please try again.';
    }
  }

  /**
   * Loads command roles from backend and populates org chart hierarchy
   */
  private loadCommandRoles(ics: any): void {
    if (!ics.command_roles || !Array.isArray(ics.command_roles)) {
      console.warn('[ICS] No command_roles in backend response');
      return;
    }

    const rolesMap = new Map<string, CommandRoleNode>();
    ics.command_roles.forEach((role: any) => {
      rolesMap.set(role.role.toLowerCase(), { role: role.role, name: role.name || '' });
    });

    // Populate org chart hierarchy
    const responsibleOfficial = rolesMap.get('responsible official');
    if (responsibleOfficial) {
      this.responsibleOfficial = responsibleOfficial;
    }

    const incidentCommander = rolesMap.get('incident commander');
    if (incidentCommander) {
      this.incidentCommander = incidentCommander;
    }

    // Section Chiefs
    const planning = rolesMap.get('planning');
    if (planning) {
      this.planning = planning;
    }

    const purchasing = rolesMap.get('purchasing');
    if (purchasing) {
      this.purchasing = purchasing;
    }

    const mwc = rolesMap.get('mwc coordinator');
    if (mwc) {
      this.mwcCoordinator = mwc;
    }

    const safety = rolesMap.get('safety & emergency');
    if (safety) {
      this.safetyEmergency = safety;
    }

    console.log('[ICS] Command roles loaded', rolesMap);
  }

  /**
   * Loads branches with teams and volunteers from backend
   */
  private loadBranchesAndTeams(ics: any): void {
    // Clear existing teams
    this.mobileKitchen.teams = [];
    this.amDistribution.teams = [];
    this.pmDistribution.teams = [];

    if (!ics.branches || !Array.isArray(ics.branches)) {
      console.warn('[ICS] No branches in backend response');
      return;
    }

    // Build a map of volunteers by team_id for quick lookup
    const volunteersByTeamId = new Map<number, any[]>();
    if (ics.volunteers && Array.isArray(ics.volunteers)) {
      ics.volunteers.forEach((volunteer: any) => {
        if (volunteer.team_id) {
          if (!volunteersByTeamId.has(volunteer.team_id)) {
            volunteersByTeamId.set(volunteer.team_id, []);
          }
          volunteersByTeamId.get(volunteer.team_id)!.push(volunteer);
        }
      });
    }

    // Build a map of AI suggestions by team_id
    const suggestionsByTeamId = new Map<number, AiSuggestion[]>();
    if (ics.ai_suggestions && Array.isArray(ics.ai_suggestions)) {
      ics.ai_suggestions.forEach((suggestion: AiSuggestion) => {
        if (suggestion.team_id) {
          if (!suggestionsByTeamId.has(suggestion.team_id)) {
            suggestionsByTeamId.set(suggestion.team_id, []);
          }
          suggestionsByTeamId.get(suggestion.team_id)!.push(suggestion);
        }
      });
    }

    // Process branches
    ics.branches.forEach((branch: any) => {
      const columnKey = this.getBranchColumnKey(branch.title);
      if (!columnKey) {
        console.warn(`[ICS] Unknown branch: ${branch.title}`);
        return;
      }

      const column = this.getColumn(columnKey);
      if (!column) {
        console.warn(`[ICS] Failed to get column for branch: ${branch.title}`);
        return;
      }

      // Set branch director name
      column.title = branch.title;
      column.leader = branch.leader || '';

      // Process teams in this branch
      if (branch.teams && Array.isArray(branch.teams)) {
        branch.teams.forEach((team: any) => {
          const teamVolunteers = volunteersByTeamId.get(team.id) || [];
          const teamSuggestions = suggestionsByTeamId.get(team.id) || [];

          // Convert backend volunteers to Volunteer interface
          const volunteers: Volunteer[] = teamVolunteers.map((vol: any) => ({
            name: vol.name,
            isNew: false,
            isDriver: false,
            isLeader: vol.role === 'Leader' || vol.role === 'Team Leader',
            skills: vol.skills || [],
            training: [],
            department: '',
            rationale: this.generateAiRationaleFromSuggestions(teamSuggestions),
            alternatives: this.extractAlternativesFromSuggestions(teamSuggestions),
          }));

          // Create team card
          const teamCard: Team = {
            name: team.name,
            volunteers,
            aiSuggestions: teamSuggestions, // Attach AI suggestions from backend
          };

          column.teams.push(teamCard);
        });
      }

      console.log(`[ICS] Loaded branch: ${branch.title} with ${column.teams.length} teams`);
    });
  }

  /**
   * Loads vehicle assignments from backend
   */
  private loadVehicles(ics: any): void {
    this.vehicleAssignments = [];

    if (!ics.vehicles || !Array.isArray(ics.vehicles)) {
      console.warn('[ICS] No vehicles in backend response');
      return;
    }

    ics.vehicles.forEach((vehicle: any) => {
      this.vehicleAssignments.push({
        code: vehicle.code || '',
        vehicle: vehicle.vehicle || '',
      });
    });

    console.log(`[ICS] Loaded ${this.vehicleAssignments.length} vehicles`);
  }

  /**
   * Maps a branch title to column key for lookup
   */
  private getBranchColumnKey(
    title: string,
  ): 'mobileKitchen' | 'amDistribution' | 'pmDistribution' | null {
    const normalized = (title || '').toLowerCase().trim();
    if (normalized.includes('mobile') && normalized.includes('kitchen')) {
      return 'mobileKitchen';
    }
    if (normalized.includes('am') && normalized.includes('distribution')) {
      return 'amDistribution';
    }
    if (normalized.includes('pm') && normalized.includes('distribution')) {
      return 'pmDistribution';
    }
    return null;
  }

  /**
   * Generates AI rationale text from suggestions array
   */
  private generateAiRationaleFromSuggestions(suggestions: AiSuggestion[]): string {
    if (suggestions.length === 0) {
      return '• No AI suggestions available\n• Manual assignment recommended';
    }

    // Use the first suggestion's reasoning if available
    const firstSuggestion = suggestions[0];
    if (firstSuggestion.reasoning) {
      return firstSuggestion.reasoning;
    }

    // Fallback: generate from confidence
    const confidence = Math.round(firstSuggestion.confidence * 100);
    return `• AI Confidence: ${confidence}%\n• Skills match: ${(firstSuggestion.skills || []).join(', ')}\n• Role: ${firstSuggestion.role}`;
  }

  /**
   * Extracts alternative volunteer names from suggestions
   */
  private extractAlternativesFromSuggestions(suggestions: AiSuggestion[]): string[] {
    return suggestions
      .slice(0, 2) // Max 2 alternatives
      .map((s) => s.volunteer_name)
      .filter((name) => name);
  }
}
