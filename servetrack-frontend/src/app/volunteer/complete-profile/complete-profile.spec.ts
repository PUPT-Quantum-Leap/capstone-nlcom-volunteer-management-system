import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProfileCompleteComponent } from './complete-profile';
import { AuthService } from '../../services/auth.service';

describe('ProfileCompleteComponent', () => {
  const mockRouter = { navigate: vi.fn() };
  const mockAuthService = {
    currentUser: vi.fn(() => ({ name: 'Test User', email: 'test@gmail.com' })),
    completeProfile$: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [ProfileCompleteComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: {} },
      ],
    });
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('does not submit when form is invalid', async () => {
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    await fixture.componentInstance.onSubmit();
    expect(mockAuthService.completeProfile$).not.toHaveBeenCalled();
  });

  it('navigates to dashboard on successful submission', async () => {
    mockAuthService.completeProfile$.mockReturnValue(of({ success: true, user: {} }));
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    const comp = fixture.componentInstance;

    // Fill required fields
    comp.form.patchValue({
      firstName: 'John',
      lastName: 'Doe',
      mobileNumber: '09123456789',
      birthdate: '1990-01-01',
      completeAddress: '123 Main Street, City, Province',
      lastMedicalExam: '2024-01-01',
      educationalAttainment: 'Bachelor',
      volunteerPreference: 'Relief Operations',
      availability: 'Weekends Only',
      partOfLifegroup: 'no',
      leadingLifegroup: 'no',
      emergencyContactName: 'Jane Doe',
      emergencyContactNumber: '09987654321',
      emergencyContactRelationship: 'Spouse',
    });

    await comp.onSubmit();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/volunteer-dashboard']);
  });
});
