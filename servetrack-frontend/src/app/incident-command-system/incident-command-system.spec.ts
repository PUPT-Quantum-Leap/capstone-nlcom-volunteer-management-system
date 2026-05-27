import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentCommandSystemComponent } from './incident-command-system';
import { RsvpService } from '../services/rsvp.service';
import { IcsService } from '../services/ics.service';
import { of } from 'rxjs';

class MockRsvpService {
  getRsvps() {
    return of({ data: [{ id: 1, title: 'Test Event', date: '2024-01-01', totalResponses: 5 }] });
  }
}

class MockIcsService {
  getIcs() { return of({ data: [] }); }
  createIcs() { return of({ data: { id: 1 } }); }
  getAiSuggestions() { return of({ data: [], meta: { message: null, total_volunteers: 0 } }); }
  applyAiSuggestions() { return of({ data: {} }); }
}

describe('IncidentCommandSystemComponent', () => {
  let component: IncidentCommandSystemComponent;
  let fixture: ComponentFixture<IncidentCommandSystemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncidentCommandSystemComponent],
      providers: [
        { provide: RsvpService, useClass: MockRsvpService },
        { provide: IcsService, useClass: MockIcsService },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentCommandSystemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the 3 operational column headers when ICS data exists', () => {
    component.hasIcsData.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const headers = compiled.querySelectorAll('.ops-column');
    expect(headers.length).toBe(3);
  });

  it('should show empty state when no ICS data', () => {
    component.hasIcsData.set(false);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const emptyState = compiled.querySelector('.ics-empty-state');
    expect(emptyState).toBeTruthy();
  });
});
