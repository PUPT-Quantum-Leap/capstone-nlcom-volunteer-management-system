import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { IncidentCommandSystemComponent } from './incident-command-system';
import { IcsDashboard } from '../models/ics';
import { RsvpService } from '../services/rsvp.service';
import { IcsService } from '../services/ics.service';

const dashboard: IcsDashboard = {
  ics_id: 10,
  metadata: { objective: null, menu: null, meal_breakfast: 0, meal_lunch: 0, meal_snacks: 0 },
  rsvp: {
    id: 1,
    title: 'Feeding Operation',
    date: '2026-06-10',
    location: 'NLCOM Center',
  },
  command_roles: [
    { key: 'responsible_official', title: 'Responsible Official', assigned_name: 'Paul Giague', volunteer_id: null },
    { key: 'incident_commander', title: 'Incident Commander', assigned_name: 'Catherine Tolentino', volunteer_id: null },
    { key: 'planning', title: 'Planning', assigned_name: 'Heidi Giague', volunteer_id: null },
    { key: 'purchasing', title: 'Purchasing', assigned_name: 'Stephanie Tan', volunteer_id: null },
    { key: 'mwc_coordinator', title: 'MWC Coordinator', assigned_name: 'Kevin Tabares', volunteer_id: null },
    { key: 'safety_emergency', title: 'Safety & Emergency', assigned_name: 'Sam Obmerga', volunteer_id: null },
    { key: 'mobile_kitchen_director', title: 'Mobile Kitchen', assigned_name: 'Elisa Aguipo', volunteer_id: null },
    { key: 'am_distribution_director', title: 'AM Distribution', assigned_name: 'Steph Tan', volunteer_id: null },
    { key: 'pm_distribution_director', title: 'PM Distribution', assigned_name: 'Steph Tan', volunteer_id: null },
  ],
  branches: [
    {
      key: 'mobile_kitchen',
      title: 'Mobile Kitchen',
      teams: [
        {
          id: 101,
          key: 'kitchen_truck',
          name: 'Kitchen Truck',
          branch_key: 'mobile_kitchen',
          vehicle: null,
          assigned_volunteers: [
            {
              id: 1,
              name: 'John Doe',
              role: 'Team Member',
              is_driver: false,
              is_leader: false,
              skills: ['Cooking'],
            },
          ],
          ai_suggestion: {
            rationale: ['95% attendance record', 'Expert in cooking'],
            candidates: [
              {
                volunteer_id: 2,
                name: 'Jane Smith',
                role: 'Team Member',
                confidence: 0.92,
                skills: ['Food Prep'],
              },
            ],
          },
        },
      ],
    },
    { key: 'am_distribution', title: 'AM Distribution', teams: [] },
    { key: 'pm_distribution', title: 'PM Distribution', teams: [] },
  ],
  vehicles: [{ team_key: 'alpha', team_name: 'Alpha', vehicle: 'Flexi' }],
};

class MockRsvpService {
  getRsvps() {
    return of({
      data: [
        {
          id: 1,
          title: 'Feeding Operation',
          date: '2026-06-10',
          totalResponses: 5,
        },
      ],
    });
  }
}

class MockIcsService {
  getDashboard() {
    return of({ data: dashboard });
  }

  getAiSuggestions() {
    return of({ data: [], meta: { message: null, total_volunteers: 0 } });
  }

  updateCommandRole() {
    return of({ data: dashboard });
  }

  assignVolunteer() {
    return of({ message: 'Volunteer assigned successfully.' });
  }

  removeVolunteer() {
    return of({ message: 'Volunteer removed successfully.' });
  }

  getRsvpVolunteers() {
    return of({ data: [] });
  }

  applyAiSuggestions() {
    return of({ data: dashboard });
  }
}

describe('IncidentCommandSystemComponent', () => {
  let fixture: ComponentFixture<IncidentCommandSystemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncidentCommandSystemComponent],
      providers: [
        { provide: RsvpService, useClass: MockRsvpService },
        { provide: IcsService, useClass: MockIcsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentCommandSystemComponent);
    fixture.detectChanges();
  });

  it('renders fixed command roles from the dashboard payload', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Responsible Official');
    expect(compiled.textContent).toContain('Paul Giague');
    expect(compiled.textContent).toContain('Incident Commander');
    expect(compiled.textContent).toContain('Catherine Tolentino');
  });

  it('renders branch columns and dynamic team cards', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.ops-column')).toHaveLength(3);
    expect(compiled.textContent).toContain('Kitchen Truck');
    expect(compiled.textContent).toContain('John Doe');
  });

  it('renders AI suggestions inside team cards', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('AI Suggestion');
    expect(compiled.textContent).toContain('95% attendance record');
    expect(compiled.textContent).toContain('Jane Smith');
  });
});
