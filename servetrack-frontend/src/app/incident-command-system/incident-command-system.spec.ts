import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentCommandSystemComponent } from './incident-command-system';
import { RsvpService } from '../services/rsvp.service';
import { of } from 'rxjs';

class MockRsvpService {
  getRsvps() {
    return of({ data: [{ id: 1, title: 'Test Event', date: '2024-01-01', totalResponses: 5 }] });
  }
}

describe('IncidentCommandSystemComponent', () => {
  let component: IncidentCommandSystemComponent;
  let fixture: ComponentFixture<IncidentCommandSystemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncidentCommandSystemComponent],
      providers: [{ provide: RsvpService, useClass: MockRsvpService }]
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentCommandSystemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the 3 operational column headers', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const headers = compiled.querySelectorAll('.ops-column');
    expect(headers.length).toBe(3);
  });

  it('should have operational columns with correct structure', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const opsSection = compiled.querySelector('.ops-section');
    expect(opsSection).toBeTruthy();

    const columns = compiled.querySelectorAll('.ops-column');
    expect(columns.length).toBe(3);
  });
});
