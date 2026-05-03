import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RsvpService } from '../services/rsvp.service';
import { Rsvp } from '../models/rsvp';

export interface Volunteer {
  name: string;
  isNew: boolean;
  isDriver: boolean;
  isLeader: boolean;
}

export interface Team {
  name: string;
  volunteers: Volunteer[];
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
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, FormsModule],
  standalone: true,
})
export class IncidentCommandSystemComponent implements OnInit {
  private rsvpService = inject(RsvpService);

  // Edit mode state
  isEditMode = false;
  isLoading = false;
  error: string | null = null;

  // Backend data
  rsvpList: Rsvp[] = [];
  selectedRsvp: Rsvp | null = null;

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

  // New volunteer input for adding to teams
  newVolunteerName = '';
  selectedColumn: 'mobileKitchen' | 'amDistribution' | 'pmDistribution' | null = null;
  selectedTeamIndex = -1;

  // Edit mode for new values
  newObjective = '';
  newMenu = '';
  newDate = '';

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
  addVolunteer(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number): void {
    if (this.newVolunteerName.trim()) {
      const column = this.getColumn(columnKey);
      if (column && column.teams[teamIndex]) {
        column.teams[teamIndex].volunteers.push({
          name: this.newVolunteerName.trim(),
          isNew: false,
          isDriver: false,
          isLeader: false
        });
        this.newVolunteerName = '';
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

  // Generate New ICS - populates all data including RSVP header and volunteer teams
  generateNewICS(): void {
    if (this.selectedRsvp) {
      // Display the RSVP header data
      this.mapRsvpToComponent(this.selectedRsvp);
      // Populate the sample volunteer and team data
      this.populateSampleData();
      console.log('Generated ICS with data from:', this.selectedRsvp.title);
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
        { name: 'KITCHEN TRUCK', volunteers: [{ name: 'Miah', isNew: false, isDriver: false, isLeader: false }, { name: 'Jones', isNew: false, isDriver: false, isLeader: false }, { name: 'Sam', isNew: false, isDriver: false, isLeader: false }, { name: 'Rice: Blessing', isNew: false, isDriver: false, isLeader: false }] },
        { name: 'FOOD PREP', volunteers: [{ name: 'Teresa^', isNew: false, isDriver: false, isLeader: true }, { name: 'Cath^a', isNew: false, isDriver: false, isLeader: false }, { name: 'Natasya', isNew: false, isDriver: false, isLeader: false }, { name: 'Michay', isNew: false, isDriver: false, isLeader: false }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false }, { name: 'Evenmae', isNew: false, isDriver: false, isLeader: false }] },
        { name: 'VOLUNTEER CARE', volunteers: [{ name: 'Myrrh^', isNew: false, isDriver: false, isLeader: true }, { name: 'Rhia^a', isNew: false, isDriver: false, isLeader: false }, { name: 'Lady', isNew: false, isDriver: false, isLeader: false }] },
        { name: 'WASH / CLEAN UP', volunteers: [{ name: 'Orly^', isNew: false, isDriver: false, isLeader: false }, { name: 'John', isNew: false, isDriver: false, isLeader: false }, { name: 'Daniel', isNew: false, isDriver: false, isLeader: false }, { name: 'Ariel', isNew: false, isDriver: false, isLeader: false }] },
        { name: 'INVENTORY', volunteers: [{ name: 'Beth^', isNew: false, isDriver: false, isLeader: false }, { name: 'Nestor', isNew: false, isDriver: false, isLeader: false }, { name: 'Johan (pm)', isNew: false, isDriver: false, isLeader: false }] },
      ]
    };

    // AM Distribution
    this.amDistribution = {
      title: 'AM DISTRIBUTION',
      leader: 'Steph Tan',
      teams: [
        { name: 'TEAM ALPHA (PYP/GANNET)', volunteers: [{ name: 'Kevin~', isNew: false, isDriver: true, isLeader: false }] },
        { name: 'TEAM BRAVO (MX/NBN)', volunteers: [{ name: 'John~', isNew: false, isDriver: true, isLeader: false }, { name: 'Blessing', isNew: false, isDriver: false, isLeader: false }, { name: 'Natasya', isNew: false, isDriver: false, isLeader: false }, { name: 'Jhay2', isNew: false, isDriver: false, isLeader: false }, { name: 'Evenmae', isNew: false, isDriver: false, isLeader: false }] },
        { name: 'TEAM CHARLIE1 (MASVILLE)', volunteers: [{ name: 'Sam~', isNew: false, isDriver: true, isLeader: false }, { name: 'Michay^', isNew: false, isDriver: false, isLeader: true }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false }] },
        { name: 'TEAM CHARLIE2 (BANAJ)', volunteers: [{ name: 'Orly~', isNew: false, isDriver: true, isLeader: false }, { name: 'Daniel', isNew: false, isDriver: false, isLeader: false }, { name: 'Rhia', isNew: false, isDriver: false, isLeader: false }] },
      ]
    };

    // PM Distribution
    this.pmDistribution = {
      title: 'PM DISTRIBUTION',
      leader: 'Steph Tan',
      teams: [
        { name: 'TEAM DELTA1 (SITIO P)', volunteers: [{ name: 'Cedie~', isNew: false, isDriver: true, isLeader: false }, { name: 'Lady~', isNew: false, isDriver: true, isLeader: false }] },
        { name: 'TEAM DELTA2 (SUCAT H)', volunteers: [{ name: 'Michael S~', isNew: false, isDriver: true, isLeader: false }, { name: 'Karl', isNew: false, isDriver: false, isLeader: false }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false }] },
        { name: 'TEAM ECHO (DELPAN)', volunteers: [{ name: 'John~', isNew: false, isDriver: true, isLeader: false }, { name: 'Cath^', isNew: false, isDriver: false, isLeader: true }, { name: 'Johan', isNew: false, isDriver: false, isLeader: false }] },
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

        if (this.rsvpList.length === 0) {
          this.error = 'No RSVP events found. Please create an RSVP event first.';
        } else {
          // Select first RSVP but DON'T display data yet
          this.selectedRsvp = this.rsvpList[0];
          this.rsvpId = this.rsvpList[0].id;
          console.log('Selected RSVP (data not displayed yet):', this.selectedRsvp.title);
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
        this.selectedRsvp = response.data;
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
        this.selectedRsvp = found;
        this.rsvpId = id;
        console.log('Selected RSVP for generation:', found.title);
      }
    }
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
}
