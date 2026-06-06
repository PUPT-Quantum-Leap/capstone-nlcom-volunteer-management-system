import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProfileCompleteComponent, DRAFT_STORAGE_KEY } from './complete-profile';
import { AuthService } from '../../services/auth.service';

describe('ProfileCompleteComponent', () => {
  const mockRouter = { navigate: vi.fn() };
  const mockAuthService = {
    currentUser: vi.fn(() => ({ name: 'Test User', email: 'test@gmail.com' })),
    completeProfile$: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [ProfileCompleteComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: {} },
      ],
    });
  });

  function validStep1Values() {
    return {
      birthdate: '1990-01-01',
      completeAddress: '123 Main Street, City, Province',
      lastMedicalExam: '2024-01-01',
    };
  }

  function validStep3Values() {
    return {
      volunteerPreference: 'Relief Operations',
      availability: 'Weekends Only',
      partOfLifegroup: 'no',
      leadingLifegroup: 'no',
    };
  }

  it('creates the component', () => {
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('starts on step 1 and hides the back button', () => {
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.currentStep()).toBe(1);
    expect(comp.isFirstStep()).toBe(true);
    expect(comp.isLastStep()).toBe(false);
  });

  it('does not advance when current step is invalid', () => {
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.nextStep();
    expect(comp.currentStep()).toBe(1);
    expect(comp.stepError()).toBeTruthy();
  });

  it('advances to next step when current step is valid', () => {
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.form.patchValue(validStep1Values());
    comp.nextStep();
    expect(comp.currentStep()).toBe(2);
    expect(comp.stepError()).toBeNull();
    expect(comp.completedSteps().has(1)).toBe(true);
  });

  it('returns to previous step on back', () => {
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.form.patchValue(validStep1Values());
    comp.nextStep();
    comp.form.patchValue({ educationalAttainment: 'Bachelor' });
    comp.nextStep();
    expect(comp.currentStep()).toBe(3);
    comp.prevStep();
    expect(comp.currentStep()).toBe(2);
    comp.prevStep();
    expect(comp.currentStep()).toBe(1);
  });

  it('does not call completeProfile$ when form is invalid', async () => {
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    await fixture.componentInstance.onSubmit();
    expect(mockAuthService.completeProfile$).not.toHaveBeenCalled();
  });

  it('navigates to dashboard on successful submission', async () => {
    mockAuthService.completeProfile$.mockReturnValue(of({ success: true, user: {} }));
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

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

  it('persists draft to sessionStorage on form change', () => {
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.form.patchValue({ birthdate: '1995-05-05' });
    expect(sessionStorage.getItem(DRAFT_STORAGE_KEY)).toBeTruthy();
    const parsed = JSON.parse(sessionStorage.getItem(DRAFT_STORAGE_KEY)!);
    expect(parsed.values.birthdate).toBe('1995-05-05');
  });

  it('clears draft on successful submit', async () => {
    mockAuthService.completeProfile$.mockReturnValue(of({ success: true, user: {} }));
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

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
    expect(sessionStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('goToStep allows jumping back to a completed step', () => {
    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.form.patchValue(validStep1Values());
    comp.nextStep();
    comp.form.patchValue({ educationalAttainment: 'Bachelor' });
    comp.nextStep();
    comp.form.patchValue(validStep3Values());
    comp.nextStep();
    expect(comp.currentStep()).toBe(4);
    comp.goToStep(1);
    expect(comp.currentStep()).toBe(1);
  });

  it('restoreDraft restores step, values, and completed steps from sessionStorage', () => {
    const draft = {
      step: 3,
      values: {
        firstName: 'Jane',
        lastName: 'Doe',
        mobileNumber: '09123456789',
        birthdate: '1992-02-02',
        completeAddress: '456 Avenue, City',
        lastMedicalExam: '2024-06-01',
        educationalAttainment: 'College',
        volunteerPreference: 'Relief Operations',
        availability: 'Weekends Only',
        partOfLifegroup: 'yes',
        lifegroupLeaderName: 'Leader Name',
        leadingLifegroup: 'no',
      },
    };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

    const fixture = TestBed.createComponent(ProfileCompleteComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.currentStep()).toBe(3);
    expect(comp.form.get('firstName')?.value).toBe('Jane');
    expect(comp.form.get('birthdate')?.value).toBe('1992-02-02');
    expect(comp.form.get('educationalAttainment')?.value).toBe('College');
    expect(comp.completedSteps().has(1)).toBe(true);
    expect(comp.completedSteps().has(2)).toBe(true);
  });
});

