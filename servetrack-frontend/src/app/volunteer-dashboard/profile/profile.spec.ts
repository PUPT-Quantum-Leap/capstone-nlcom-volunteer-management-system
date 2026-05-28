import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfileComponent } from './profile';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { VolunteerService } from '../../services/volunteer.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let mockAuthService: Partial<AuthService>;
  let mockVolunteerService: Partial<VolunteerService>;
  let mockSanitizer: Partial<InputSanitizerService>;

  const mockProfileData = {
    volunteer_id: 1,
    first_name: 'John',
    last_name: 'Doe',
    facebook_name: 'johndoe',
    email: 'john@example.com',
    mobile_number: '09123456789',
    birthdate: '1990-01-01',
    last_medical_examination: '2025-06-15',
    address: '123 Test St, City',
    educational_attainment: 'College',
    training_experience: 'Some experience',
    skills_hobbies: 'Reading, coding',
    classes_training: 'First Aid',
    photo_url: '',
    positions: [{ position_id: 1, name: 'wherever-needed' }],
    availabilities: [{ name: 'Anytime / On Call', pivot: { custom_description: '' } }],
    lifegroups: [],
    emergency_contact: {
      name: 'Jane Doe',
      phone_number: '09123456789',
      relationship: 'friend',
    },
  };

  beforeEach(async () => {
    mockAuthService = {
      currentUser: signal({ id: '1', name: 'John Doe', email: 'john@example.com', role: 'volunteer' }),
    };

    mockVolunteerService = {
      getProfile: vi.fn().mockReturnValue(of({ success: true, data: mockProfileData, message: '' })),
      updateProfile: vi.fn().mockReturnValue(of({ success: true, data: mockProfileData, message: '' })),
    };

    mockSanitizer = {
      sanitizeInput: vi.fn().mockImplementation((input: string) => input),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: VolunteerService, useValue: mockVolunteerService },
        { provide: InputSanitizerService, useValue: mockSanitizer },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load profile on init', () => {
    expect(mockVolunteerService.getProfile).toHaveBeenCalled();
    expect(component.savedProfileData()).toEqual(mockProfileData);
  });

  it('should have form disabled after loading profile', () => {
    expect(component.profileForm.disabled).toBe(true);
    expect(component.isEditMode()).toBe(false);
  });

  it('should enable form in edit mode', () => {
    component.toggleEditMode();
    expect(component.isEditMode()).toBe(true);
    expect(component.profileForm.enabled).toBe(true);
  });

  it('should exit edit mode and restore saved data on cancel', () => {
    component.enterEditMode();
    component.profileForm.patchValue({ firstName: 'Changed' });
    expect(component.profileForm.get('firstName')?.value).toBe('Changed');

    component.exitEditMode(true);
    expect(component.isEditMode()).toBe(false);
    expect(component.profileForm.get('firstName')?.value).toBe('John');
    expect(component.profileForm.disabled).toBe(true);
  });

  it('should not open save confirm modal when form is invalid', () => {
    component.enterEditMode();
    component.profileForm.get('firstName')?.setValue('');
    component.profileForm.get('firstName')?.markAsTouched();
    component.openSaveConfirmModal();
    expect(component.showSaveConfirmModal()).toBe(false);
  });

  it('should show save confirm modal when form is valid', () => {
    component.enterEditMode();
    expect(component.profileForm.valid).toBe(true);
    component.openSaveConfirmModal();
    expect(component.showSaveConfirmModal()).toBe(true);
  });

  it('should call updateProfile on save', () => {
    component.enterEditMode();
    component.openSaveConfirmModal();
    component.confirmSaveProfile();

    expect(mockVolunteerService.updateProfile).toHaveBeenCalled();
  });

  it('should toggle accordion sections', () => {
    expect(component.expandedSection()).toBe('personal');
    component.toggleSection('service');
    expect(component.expandedSection()).toBe('service');
    component.toggleSection('service');
    expect(component.expandedSection()).toBeNull();
  });

  it('should provide correct completion percentage', () => {
    const completion = component.profileCompletion();
    expect(completion).toBeGreaterThanOrEqual(0);
    expect(completion).toBeLessThanOrEqual(100);
  });

  it('should show otherPreference field when volunteerPreference is other', () => {
    component.onVolunteerPreferenceChange({ target: { value: 'other' } } as unknown as Event);
    expect(component.showOtherPreference()).toBe(true);

    component.onVolunteerPreferenceChange({ target: { value: 'mobile-kitchen' } } as unknown as Event);
    expect(component.showOtherPreference()).toBe(false);
  });

  it('should validate mobile number pattern', () => {
    component.enterEditMode();
    const mobileControl = component.profileForm.get('mobileNumber');
    mobileControl?.setValue('invalid');
    expect(mobileControl?.valid).toBe(false);

    mobileControl?.setValue('09123456789');
    expect(mobileControl?.valid).toBe(true);

    mobileControl?.setValue('+639123456789');
    expect(mobileControl?.valid).toBe(true);
  });

  it('should validate required fields', () => {
    component.enterEditMode();
    expect(component.controlHasError('firstName')).toBe(false);

    component.profileForm.get('firstName')?.setValue('');
    component.profileForm.get('firstName')?.markAsTouched();
    expect(component.controlHasError('firstName')).toBe(true);
    expect(component.getControlError('firstName')).toBe('This field is required');
  });
});
