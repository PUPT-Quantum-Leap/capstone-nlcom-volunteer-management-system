import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class IncidentCommandSystemComponent {
  // Edit mode state
  isEditMode = false;

  // Header Information - Dynamic
  objective = 2400;
  menu = 'Champorado';
  date = 'November 22, 2025';
  volunteers = 46;

  // Command Hierarchy - Dynamic
  responsibleOfficial: CommandRole = { role: 'Responsible Official', name: 'Paul Giague' };
  incidentCommander: CommandRole = { role: 'Incident Commander', name: 'Catherine Tolentino' };
  planning: CommandRole = { role: 'Planning', name: 'Heidi Giague' };
  purchasing: CommandRole = { role: 'Purchasing', name: 'Stephanie Tan' };
  mwcCoordinator: CommandRole = { role: 'MWC Coordinator', name: 'Kevin Tabares' };
  safetyEmergency: CommandRole = { role: 'Safety & Emergency', name: 'Sam Obmerga' };

  // Operational Columns - Dynamic
  mobileKitchen: OperationalColumn = {
    title: 'Mobile Kitchen',
    leader: 'Elisa Aguipo',
    teams: [
      { name: 'Kitchen Truck', volunteers: [{ name: 'Miah', isNew: false, isDriver: false, isLeader: false }, { name: 'Jones', isNew: false, isDriver: false, isLeader: false }, { name: 'Sam', isNew: false, isDriver: false, isLeader: false }, { name: 'Rice: Blessing', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Food Prep', volunteers: [{ name: 'Teresa', isNew: false, isDriver: false, isLeader: false }, { name: 'Catha', isNew: false, isDriver: false, isLeader: false }, { name: 'Natasya', isNew: false, isDriver: false, isLeader: false }, { name: 'Michay', isNew: false, isDriver: false, isLeader: false }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false }, { name: 'Evenmee', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Volunteer Care', volunteers: [{ name: 'Myrrh', isNew: false, isDriver: false, isLeader: false }, { name: 'Rhia', isNew: false, isDriver: false, isLeader: false }, { name: 'Lady', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Wash / Clean Up', volunteers: [{ name: 'Orly', isNew: false, isDriver: false, isLeader: false }, { name: 'John', isNew: false, isDriver: false, isLeader: false }, { name: 'Daniel', isNew: false, isDriver: false, isLeader: false }, { name: 'Ariel', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Inventory', volunteers: [{ name: 'Beth', isNew: false, isDriver: false, isLeader: false }, { name: 'Nestor', isNew: false, isDriver: false, isLeader: false }, { name: 'Johan (pm)', isNew: false, isDriver: false, isLeader: false }] },
    ]
  };

  amDistribution: OperationalColumn = {
    title: 'AM Distribution',
    leader: 'Steph Tan',
    teams: [
      { name: 'Team Alpha', volunteers: [{ name: 'Kevin', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Bravo', volunteers: [{ name: 'John', isNew: false, isDriver: false, isLeader: false }, { name: 'Blessing', isNew: false, isDriver: false, isLeader: false }, { name: 'Natasya', isNew: false, isDriver: false, isLeader: false }, { name: 'Jhay', isNew: false, isDriver: false, isLeader: false }, { name: 'Evenmee', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Charlie 1', volunteers: [{ name: 'Sam', isNew: false, isDriver: false, isLeader: false }, { name: 'Michay', isNew: false, isDriver: false, isLeader: false }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Charlie 2', volunteers: [{ name: 'Orly', isNew: false, isDriver: false, isLeader: false }, { name: 'Daniel', isNew: false, isDriver: false, isLeader: false }, { name: 'Rhia', isNew: false, isDriver: false, isLeader: false }] },
    ]
  };

  pmDistribution: OperationalColumn = {
    title: 'PM Distribution',
    leader: 'Steph Tan',
    teams: [
      { name: 'Team Delta 1', volunteers: [{ name: 'Cedie', isNew: false, isDriver: false, isLeader: false }, { name: 'Lady', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Delta 2', volunteers: [{ name: 'Michael', isNew: false, isDriver: false, isLeader: false }, { name: 'Karl', isNew: false, isDriver: false, isLeader: false }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Echo', volunteers: [{ name: 'John', isNew: false, isDriver: false, isLeader: false }, { name: 'Catha', isNew: false, isDriver: false, isLeader: false }, { name: 'Johan', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Foxtrot', volunteers: [] },
    ]
  };

  // Meal Breakdown - Dynamic
  mealBreakdown: MealBreakdown = {
    breakfast: 40,
    lunch: 50,
    snacks: 50
  };

  // Vehicle Assignments - Dynamic
  vehicleAssignments: VehicleAssignment[] = [
    { code: 'Alpha', vehicle: 'Flexi' },
    { code: 'Bravo', vehicle: 'Hilux' },
    { code: 'Charlie 1', vehicle: 'Clipper' },
    { code: 'Charlie 2', vehicle: 'Chevy' },
    { code: 'Delta 1', vehicle: 'Hilux' },
    { code: 'Delta 2', vehicle: 'Black' },
    { code: 'Echo', vehicle: 'Chevy' },
    { code: 'Foxtrot', vehicle: 'Flexi/Clipper' },
  ];

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
    if (volunteer.isLeader) symbols += '^/^';
    return symbols;
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

  // Generate New ICS - resets to default values
  generateNewICS(): void {
    this.objective = 0;
    this.menu = '';
    this.date = '';
    this.volunteers = 0;
    this.responsibleOfficial.name = '';
    this.incidentCommander.name = '';
    this.planning.name = '';
    this.purchasing.name = '';
    this.mwcCoordinator.name = '';
    this.safetyEmergency.name = '';
    this.mobileKitchen.leader = '';
    this.mobileKitchen.teams = [];
    this.amDistribution.leader = '';
    this.amDistribution.teams = [];
    this.pmDistribution.leader = '';
    this.pmDistribution.teams = [];
    this.mealBreakdown = { breakfast: 0, lunch: 0, snacks: 0 };
    this.vehicleAssignments = [];
  }
}

