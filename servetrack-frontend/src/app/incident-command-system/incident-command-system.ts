import { ChangeDetectionStrategy, Component, signal, computed } from '@angular/core';
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
  isEditMode = signal(false);

  // Header Information - Dynamic
  objective = signal(2400);
  menu = signal('Champorado');
  date = signal('November 22, 2025');

  // Command Hierarchy - Dynamic
  responsibleOfficial = signal<CommandRole>({ role: 'Responsible Official', name: 'Paul Giague' });
  incidentCommander = signal<CommandRole>({ role: 'Incident Commander', name: 'Catherine Tolentino' });
  planning = signal<CommandRole>({ role: 'Planning', name: 'Heidi Giague' });
  purchasing = signal<CommandRole>({ role: 'Purchasing', name: 'Stephanie Tan' });
  mwcCoordinator = signal<CommandRole>({ role: 'MWC Coordinator', name: 'Kevin Tabares' });
  safetyEmergency = signal<CommandRole>({ role: 'Safety & Emergency', name: 'Sam Obmerga' });

  // Operational Columns - Dynamic
  mobileKitchen = signal<OperationalColumn>({
    title: 'Mobile Kitchen',
    leader: 'Elisa Aguipo',
    teams: [
      { name: 'Kitchen Truck', volunteers: [{ name: 'Miah', isNew: false, isDriver: false, isLeader: false }, { name: 'Jones', isNew: false, isDriver: false, isLeader: false }, { name: 'Sam', isNew: false, isDriver: false, isLeader: false }, { name: 'Rice: Blessing', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Food Prep', volunteers: [{ name: 'Teresa', isNew: false, isDriver: false, isLeader: false }, { name: 'Catha', isNew: false, isDriver: false, isLeader: false }, { name: 'Natasya', isNew: false, isDriver: false, isLeader: false }, { name: 'Michay', isNew: false, isDriver: false, isLeader: false }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false }, { name: 'Evenmee', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Volunteer Care', volunteers: [{ name: 'Myrrh', isNew: false, isDriver: false, isLeader: false }, { name: 'Rhia', isNew: false, isDriver: false, isLeader: false }, { name: 'Lady', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Wash / Clean Up', volunteers: [{ name: 'Orly', isNew: false, isDriver: false, isLeader: false }, { name: 'John', isNew: false, isDriver: false, isLeader: false }, { name: 'Daniel', isNew: false, isDriver: false, isLeader: false }, { name: 'Ariel', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Inventory', volunteers: [{ name: 'Beth', isNew: false, isDriver: false, isLeader: false }, { name: 'Nestor', isNew: false, isDriver: false, isLeader: false }, { name: 'Johan (pm)', isNew: false, isDriver: false, isLeader: false }] },
    ]
  });

  amDistribution = signal<OperationalColumn>({
    title: 'AM Distribution',
    leader: 'Steph Tan',
    teams: [
      { name: 'Team Alpha', volunteers: [{ name: 'Kevin', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Bravo', volunteers: [{ name: 'John', isNew: false, isDriver: false, isLeader: false }, { name: 'Blessing', isNew: false, isDriver: false, isLeader: false }, { name: 'Natasya', isNew: false, isDriver: false, isLeader: false }, { name: 'Jhay', isNew: false, isDriver: false, isLeader: false }, { name: 'Evenmee', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Charlie 1', volunteers: [{ name: 'Sam', isNew: false, isDriver: false, isLeader: false }, { name: 'Michay', isNew: false, isDriver: false, isLeader: false }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Charlie 2', volunteers: [{ name: 'Orly', isNew: false, isDriver: false, isLeader: false }, { name: 'Daniel', isNew: false, isDriver: false, isLeader: false }, { name: 'Rhia', isNew: false, isDriver: false, isLeader: false }] },
    ]
  });

  pmDistribution = signal<OperationalColumn>({
    title: 'PM Distribution',
    leader: 'Steph Tan',
    teams: [
      { name: 'Team Delta 1', volunteers: [{ name: 'Cedie', isNew: false, isDriver: false, isLeader: false }, { name: 'Lady', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Delta 2', volunteers: [{ name: 'Michael', isNew: false, isDriver: false, isLeader: false }, { name: 'Karl', isNew: false, isDriver: false, isLeader: false }, { name: 'Aly', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Echo', volunteers: [{ name: 'John', isNew: false, isDriver: false, isLeader: false }, { name: 'Catha', isNew: false, isDriver: false, isLeader: false }, { name: 'Johan', isNew: false, isDriver: false, isLeader: false }] },
      { name: 'Team Foxtrot', volunteers: [] },
    ]
  });

  volunteers = computed(() => {
    let count = 0;
    this.mobileKitchen().teams.forEach(team => count += team.volunteers.length);
    this.amDistribution().teams.forEach(team => count += team.volunteers.length);
    this.pmDistribution().teams.forEach(team => count += team.volunteers.length);
    return count;
  });

  // Meal Breakdown - Dynamic
  mealBreakdown = signal<MealBreakdown>({
    breakfast: 40,
    lunch: 50,
    snacks: 50
  });

  // Vehicle Assignments - Dynamic
  vehicleAssignments = signal<VehicleAssignment[]>([
    { code: 'Alpha', vehicle: 'Flexi' },
    { code: 'Bravo', vehicle: 'Hilux' },
    { code: 'Charlie 1', vehicle: 'Clipper' },
    { code: 'Charlie 2', vehicle: 'Chevy' },
    { code: 'Delta 1', vehicle: 'Hilux' },
    { code: 'Delta 2', vehicle: 'Black' },
    { code: 'Echo', vehicle: 'Chevy' },
    { code: 'Foxtrot', vehicle: 'Flexi/Clipper' },
  ]);

  // New volunteer input for adding to teams
  newVolunteerName = signal('');
  selectedColumn = signal<'mobileKitchen' | 'amDistribution' | 'pmDistribution' | null>(null);
  selectedTeamIndex = signal(-1);

  // Edit mode for new values
  newObjective = signal('');
  newMenu = signal('');
  newDate = signal('');

  updateColumnTitle(key: string, title: string): void {
    this.updateColumn(key as any, col => ({ ...col, title }));
  }

  updateColumnLeader(key: string, leader: string): void {
    this.updateColumn(key as any, col => ({ ...col, leader }));
  }

  updateTeamName(key: string, teamIndex: number, name: string): void {
    this.updateColumn(key as any, col => {
      if (col.teams[teamIndex]) col.teams[teamIndex].name = name;
      return { ...col };
    });
  }

  updateVehicleCode(index: number, code: string): void {
    this.vehicleAssignments.update(arr => {
      const newArr = [...arr];
      if (newArr[index]) newArr[index].code = code;
      return newArr;
    });
  }

  updateVehicleName(index: number, vehicle: string): void {
    this.vehicleAssignments.update(arr => {
      const newArr = [...arr];
      if (newArr[index]) newArr[index].vehicle = vehicle;
      return newArr;
    });
  }

  updateMealBreakfast(val: number) { this.mealBreakdown.update(m => ({...m, breakfast: val})); }
  updateMealLunch(val: number) { this.mealBreakdown.update(m => ({...m, lunch: val})); }
  updateMealSnacks(val: number) { this.mealBreakdown.update(m => ({...m, snacks: val})); }

  updateCommandRole(roleKey: 'responsibleOfficial'|'incidentCommander'|'planning'|'purchasing'|'mwcCoordinator'|'safetyEmergency', name: string) {
    this[roleKey].update(r => ({...r, name}));
  }

  toggleEditMode(): void {
    if (this.isEditMode()) {
      // Save changes - update the actual values
      if (this.newObjective()) {
        this.objective.set(parseInt(this.newObjective(), 10) || this.objective());
      }
      if (this.newMenu()) {
        this.menu.set(this.newMenu());
      }
      if (this.newDate()) {
        this.date.set(this.newDate());
      }
    } else {
      // Enter edit mode - initialize new values
      this.newObjective.set(this.objective().toString());
      this.newMenu.set(this.menu());
      this.newDate.set(this.date());
    }
    this.isEditMode.update(v => !v);
  }

  // Volunteer management
  addVolunteer(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number): void {
    const name = this.newVolunteerName().trim();
    if (name) {
      this.updateColumn(columnKey, (col) => {
        if (col.teams[teamIndex]) {
          col.teams[teamIndex].volunteers.push({
            name,
            isNew: false,
            isDriver: false,
            isLeader: false
          });
        }
        return { ...col };
      });
      this.newVolunteerName.set('');
    }
  }

  removeVolunteer(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number, volunteerIndex: number): void {
    this.updateColumn(columnKey, (col) => {
      if (col.teams[teamIndex]) {
        col.teams[teamIndex].volunteers.splice(volunteerIndex, 1);
      }
      return { ...col };
    });
  }

  toggleNewVolunteer(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number, volunteerIndex: number): void {
    this.updateColumn(columnKey, (col) => {
      if (col.teams[teamIndex] && col.teams[teamIndex].volunteers[volunteerIndex]) {
        col.teams[teamIndex].volunteers[volunteerIndex].isNew = !col.teams[teamIndex].volunteers[volunteerIndex].isNew;
      }
      return { ...col };
    });
  }

  toggleDriver(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number, volunteerIndex: number): void {
    this.updateColumn(columnKey, (col) => {
      if (col.teams[teamIndex] && col.teams[teamIndex].volunteers[volunteerIndex]) {
        col.teams[teamIndex].volunteers[volunteerIndex].isDriver = !col.teams[teamIndex].volunteers[volunteerIndex].isDriver;
      }
      return { ...col };
    });
  }

  toggleLeader(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number, volunteerIndex: number): void {
    this.updateColumn(columnKey, (col) => {
      if (col.teams[teamIndex] && col.teams[teamIndex].volunteers[volunteerIndex]) {
        col.teams[teamIndex].volunteers[volunteerIndex].isLeader = !col.teams[teamIndex].volunteers[volunteerIndex].isLeader;
      }
      return { ...col };
    });
  }

  private updateColumn(key: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', updater: (col: OperationalColumn) => OperationalColumn): void {
    switch (key) {
      case 'mobileKitchen': this.mobileKitchen.update(updater); break;
      case 'amDistribution': this.amDistribution.update(updater); break;
      case 'pmDistribution': this.pmDistribution.update(updater); break;
    }
  }

  // Team management
  addTeam(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution'): void {
    this.updateColumn(columnKey, (col) => {
      col.teams.push({ name: 'New Team', volunteers: [] });
      return { ...col };
    });
  }

  removeTeam(columnKey: 'mobileKitchen' | 'amDistribution' | 'pmDistribution', teamIndex: number): void {
    this.updateColumn(columnKey, (col) => {
      if (col.teams[teamIndex]) {
        col.teams.splice(teamIndex, 1);
      }
      return { ...col };
    });
  }

  // Vehicle management
  addVehicle(): void {
    this.vehicleAssignments.update(v => [...v, { code: 'New', vehicle: 'Vehicle' }]);
  }

  removeVehicle(index: number): void {
    this.vehicleAssignments.update(v => {
      const newV = [...v];
      newV.splice(index, 1);
      return newV;
    });
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
  operationalColumns = computed(() => [
    { key: 'mobileKitchen' as const, data: this.mobileKitchen() },
    { key: 'amDistribution' as const, data: this.amDistribution() },
    { key: 'pmDistribution' as const, data: this.pmDistribution() }
  ]);

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
    this.objective.set(0);
    this.menu.set('');
    this.date.set('');
    this.responsibleOfficial.set({ role: 'Responsible Official', name: '' });
    this.incidentCommander.set({ role: 'Incident Commander', name: '' });
    this.planning.set({ role: 'Planning', name: '' });
    this.purchasing.set({ role: 'Purchasing', name: '' });
    this.mwcCoordinator.set({ role: 'MWC Coordinator', name: '' });
    this.safetyEmergency.set({ role: 'Safety & Emergency', name: '' });
    
    this.mobileKitchen.update(col => ({ ...col, leader: '', teams: [] }));
    this.amDistribution.update(col => ({ ...col, leader: '', teams: [] }));
    this.pmDistribution.update(col => ({ ...col, leader: '', teams: [] }));
    
    this.mealBreakdown.set({ breakfast: 0, lunch: 0, snacks: 0 });
    this.vehicleAssignments.set([]);
  }
}
