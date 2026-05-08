import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  DestroyRef,
} from '@angular/core';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../../validators/password.validator';
import { AuthService } from '../../services/auth.service';
import { VolunteerService } from '../../services/volunteer.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VolunteerProfile, VolunteerProfileResponse } from '../../models/volunteer-profile';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeAllCalendars()'
  }
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private volunteerService = inject(VolunteerService);
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(InputSanitizerService);

  readonly defaultPhoto = '/assets/person.svg';

  // ── Profile State ───────────────────────────────────────────────────────
  isEditMode = signal(false);
  profilePreviewUrl = signal(this.defaultPhoto);
  profiles = signal<VolunteerProfile[]>([]);
  savedProfileData = signal<VolunteerProfileResponse | null>(null);
  expandedSection = signal<'personal' | 'service' | 'emergency' | null>('personal');
  showOtherPreference = signal(false);
  isLoading = signal(false);
  isBirthdateCalendarOpen = signal(false);
  isMedicalExamCalendarOpen = signal(false);
  calendarViewDate = signal(new Date());
  firstDayOffset = computed(() => {
    const date = this.calendarViewDate();
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  });

  toggleCalendar(type: 'birthdate' | 'medical'): void {
    if (!this.isEditMode()) return;
    
    if (type === 'birthdate') {
      this.isBirthdateCalendarOpen.update(v => !v);
      this.isMedicalExamCalendarOpen.set(false);
    } else {
      this.isMedicalExamCalendarOpen.update(v => !v);
      this.isBirthdateCalendarOpen.set(false);
    }
    
    // Initialize view date to current value or today
    const currentValue = this.profileForm.get(type === 'birthdate' ? 'birthdate' : 'lastMedicalExam')?.value;
    if (currentValue) {
      this.calendarViewDate.set(this.parseLocalISO(currentValue));
    } else {
      this.calendarViewDate.set(new Date());
    }
  }

  selectDate(type: 'birthdate' | 'medical', day: number): void {
    const date = new Date(this.calendarViewDate());
    date.setDate(day);
    const formattedDate = this.formatDateToLocalISO(date);
    
    this.profileForm.patchValue({
      [type === 'birthdate' ? 'birthdate' : 'lastMedicalExam']: formattedDate
    });
    
    if (type === 'birthdate') this.isBirthdateCalendarOpen.set(false);
    else this.isMedicalExamCalendarOpen.set(false);
  }

  changeMonth(delta: number): void {
    const current = this.calendarViewDate();
    // Anchor to day 1 before changing month to prevent skipping on short months
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    this.calendarViewDate.set(nextMonth);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.isBirthdateCalendarOpen() && !this.isMedicalExamCalendarOpen()) return;
    
    const target = event.target as HTMLElement;
    const bdPicker = document.querySelector('.birthdate-field');
    const mePicker = document.querySelector('.medical-exam-field');
    
    if (this.isBirthdateCalendarOpen() && bdPicker && !bdPicker.contains(target)) {
      this.isBirthdateCalendarOpen.set(false);
    }
    if (this.isMedicalExamCalendarOpen() && mePicker && !mePicker.contains(target)) {
      this.isMedicalExamCalendarOpen.set(false);
    }
  }

  closeAllCalendars(): void {
    this.isBirthdateCalendarOpen.set(false);
    this.isMedicalExamCalendarOpen.set(false);
  }

  getCalendarCells(): (number | null)[] {
    const date = this.calendarViewDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysCount; i++) {
      cells.push(i);
    }
    return cells;
  }

  getMonthYearLabel(): string {
    const date = this.calendarViewDate();
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
  }

  formatDateLabel(value: string | null | undefined): string {
    if (!value) return 'Select Date';
    return this.parseLocalISO(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  isDaySelected(type: 'birthdate' | 'medical', day: number): boolean {
    const value = this.profileForm.get(type === 'birthdate' ? 'birthdate' : 'lastMedicalExam')?.value;
    if (!value) return false;
    
    const viewDate = this.calendarViewDate();
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const dateStr = this.formatDateToLocalISO(date);
    
    return value === dateStr;
  }

  private parseLocalISO(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatDateToLocalISO(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ── Modal States ─────────────────────────────────────────────────────────
  showSaveConfirmModal = signal(false);
  showProfileError = signal(false);
  showProfileSuccess = signal(false);
  profileErrorMessage = signal('');
  profileSuccessMessage = signal('');

  private positionToKeyMap: Record<string, string> = {
    'Metro Sidewalk Sunday School (Teaching & Education)': 'sidewalk-sunday-school',
    'Mobile Kitchen Operations': 'mobile-kitchen',
    'Relief Operations': 'relief-operations',
    'Safety and Emergency Response': 'safety-emergency',
    'Medical Operations': 'medical-operations',
    'Psychological First Aid': 'psychological-aid',
    'Transportation & Logistics Team': 'transportation-logistics',
    'Purchasing Team': 'purchasing',
    'Individual & Corporate Partnerships': 'partnerships',
    'Digital Marketing & Promotions': 'digital-marketing',
    'Creatives (Video / Photos)': 'creatives',
    'Healing': 'healing',
    'Real Estate & Sports': 'real-estate-sports',
    'Anything kitchen-related': 'kitchen-related',
    'Wherever is needed': 'wherever-needed',
    "Don't know yet": 'dont-know',
    'Other': 'other',
  };

  profileForm = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      facebookName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^(09|\+639)\d{9}$/)]],
      birthdate: ['', [Validators.required]],
      lastMedicalExam: ['', [Validators.required]],
      completeAddress: ['', [Validators.required, Validators.minLength(10)]],
      educationalAttainment: ['', [Validators.required]],
      trainingExperience: [''],
      skillsHobbies: [''],
      classesTraining: [''],
      volunteerPreference: ['', [Validators.required]],
      otherPreference: [''],
      availability: ['', [Validators.required]],
      otherAvailability: [''],
      partOfLifegroup: ['', [Validators.required]],
      lifegroupLeaderName: [''],
      leadingLifegroup: ['', [Validators.required]],
      emergencyContactName: ['', [Validators.required]],
      emergencyContactNumber: ['', [Validators.required, Validators.pattern(/^(09|\+639)\d{9}$/)]],
      emergencyContactRelationship: ['', [Validators.required]],
      password: ['', [passwordStrengthValidator()]],
      confirmPassword: [''],
    },
    { validators: passwordMatchValidator('password', 'confirmPassword') },
  );

  profileCompletion = computed(() => {
    const savedData = this.savedProfileData();
    if (!savedData) return 0;

    const requiredFields = [
      savedData.first_name,
      savedData.last_name,
      savedData.facebook_name,
      savedData.email,
      savedData.mobile_number,
      savedData.birthdate,
      savedData.last_medical_examination,
      savedData.address,
      savedData.educational_attainment,
      savedData.positions?.length ? true : false,
    ];

    const optionalFields = [
      savedData.training_experience,
      savedData.skills_hobbies,
      savedData.classes_training,
      savedData.lifegroups?.length ? true : false,
    ];

    let completedRequired = 0;
    for (const field of requiredFields) {
      if (field && String(field).trim().length > 0) completedRequired++;
    }

    let completedOptional = 0;
    for (const field of optionalFields) {
      if (field && String(field).trim().length > 0) completedOptional++;
    }

    const requiredPercentage = (completedRequired / requiredFields.length) * 90;
    const optionalBonus = (completedOptional / optionalFields.length) * 10;

    return Math.min(100, Math.round(requiredPercentage + optionalBonus));
  });

  ngOnInit(): void {
    this.loadProfile();

    // Dynamic validation: lifegroupLeaderName required when partOfLifegroup is 'yes'
    this.profileForm.get('partOfLifegroup')?.valueChanges.subscribe((value) => {
      const leaderNameControl = this.profileForm.get('lifegroupLeaderName');
      if (value === 'yes') {
        leaderNameControl?.setValidators([Validators.required]);
      } else {
        leaderNameControl?.clearValidators();
      }
      leaderNameControl?.updateValueAndValidity();
    });
  }

  private loadProfile(): void {
    this.volunteerService.getProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.applyProfileResponse(response.data);
          this.profileForm.disable();
        }
      },
      error: (error) => {
        console.error('[ProfileComponent] Failed to load profile:', error);
        this.showProfileError.set(true);
        this.profileErrorMessage.set('Failed to load profile. Please try again later.');
      }
    });
  }

  private applyProfileResponse(data: VolunteerProfileResponse): void {
    this.savedProfileData.set(data);

    if (data.positions?.length) {
      // Update task info
    }

    const positionKey = this.getPositionKey(data.positions?.[0]?.name || '');
    const availabilityName = data.availabilities?.[0]?.name || '';
    const otherAvailability = data.availabilities?.[0]?.pivot?.custom_description ?? '';
    const availabilityKey = this.getAvailabilityKey(availabilityName);

    const isPartLifegroup = data.lifegroups?.length ? 'yes' : 'no';
    const isLeader = data.lifegroups?.[0]?.pivot?.is_leader ? 'yes' : 'no';
    const lifegroupName = data.lifegroups?.[0]?.name ?? '';

    console.log('[Profile] Applying profile data:', {
      lifegroups: data.lifegroups,
      isPartLifegroup,
      isLeader,
      lifegroupName,
    });

    // Update lifegroupLeaderName validation based on loaded data
    const leaderNameControl = this.profileForm.get('lifegroupLeaderName');
    if (isPartLifegroup === 'yes') {
      leaderNameControl?.setValidators([Validators.required]);
    } else {
      leaderNameControl?.clearValidators();
    }
    leaderNameControl?.updateValueAndValidity({ emitEvent: false });

    this.profileForm.patchValue({
      firstName: data.first_name,
      lastName: data.last_name,
      facebookName: data.facebook_name ?? '',
      email: data.email,
      mobileNumber: data.mobile_number,
      birthdate: data.birthdate,
      lastMedicalExam: data.last_medical_examination,
      completeAddress: data.address,
      educationalAttainment: data.educational_attainment,
      trainingExperience: data.training_experience ?? '',
      skillsHobbies: data.skills_hobbies ?? '',
      classesTraining: data.classes_training ?? '',
      volunteerPreference: positionKey,
      availability: availabilityKey,
      otherAvailability: otherAvailability,
      partOfLifegroup: isPartLifegroup,
      lifegroupLeaderName: lifegroupName,
      leadingLifegroup: isLeader,
      emergencyContactName: data.emergency_contact?.name ?? '',
      emergencyContactNumber: data.emergency_contact?.phone_number ?? '',
      emergencyContactRelationship: data.emergency_contact?.relationship ?? '',
    });

    this.showOtherPreference.set(positionKey === 'other');
  }

  toggleSection(section: 'personal' | 'service' | 'emergency'): void {
    if (this.expandedSection() === section) {
      this.expandedSection.set(null);
    } else {
      this.expandedSection.set(section);
    }
  }

  toggleEditMode(): void {
    if (this.isEditMode()) {
      this.exitEditMode(true);
    } else {
      this.enterEditMode();
    }
  }

  enterEditMode(): void {
    this.isEditMode.set(true);
    this.profileForm.enable();
    this.profileForm.markAllAsTouched();
  }

  exitEditMode(cancel: boolean = false): void {
    this.isEditMode.set(false);
    this.profileForm.disable();
    this.closeAllCalendars();
    if (cancel) {
      const savedData = this.savedProfileData();
      if (savedData) {
        const positionKey = this.getPositionKey(savedData.positions?.[0]?.name || '');
        const availabilityKey = this.getAvailabilityKey(savedData.availabilities?.[0]?.name || '');
        this.profileForm.patchValue({
          firstName: savedData.first_name,
          lastName: savedData.last_name,
          facebookName: savedData.facebook_name ?? '',
          email: savedData.email,
          mobileNumber: savedData.mobile_number,
          birthdate: savedData.birthdate,
          lastMedicalExam: savedData.last_medical_examination,
          completeAddress: savedData.address,
          educationalAttainment: savedData.educational_attainment,
          trainingExperience: savedData.training_experience ?? '',
          skillsHobbies: savedData.skills_hobbies ?? '',
          classesTraining: savedData.classes_training ?? '',
          volunteerPreference: positionKey,
          availability: availabilityKey,
          otherAvailability: savedData.availabilities?.[0]?.pivot?.custom_description ?? '',
          partOfLifegroup: savedData.lifegroups?.length ? 'yes' : 'no',
          lifegroupLeaderName: savedData.lifegroups?.[0]?.name ?? '',
          leadingLifegroup: savedData.lifegroups?.[0]?.pivot?.is_leader ? 'yes' : 'no',
          emergencyContactName: savedData.emergency_contact?.name ?? '',
          emergencyContactNumber: savedData.emergency_contact?.phone_number ?? '',
          emergencyContactRelationship: savedData.emergency_contact?.relationship ?? '',
        });
        // Reset UI-only state to match saved data
        this.showOtherPreference.set(positionKey === 'other');
        this.profilePreviewUrl.set(savedData.photo_url ?? this.defaultPhoto);
      }
      this.profileForm.markAsPristine();
    }
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        this.profilePreviewUrl.set(result);
      }
      reader.onload = null;
    };
    reader.readAsDataURL(file);
  }

  onVolunteerPreferenceChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.showOtherPreference.set(value === 'other');
    if (value !== 'other') {
      this.profileForm.patchValue({ otherPreference: '' });
    }
  }

  openSaveConfirmModal(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.showSaveConfirmModal.set(true);
  }

  closeSaveConfirmModal(): void {
    this.showSaveConfirmModal.set(false);
  }

  confirmSaveProfile(): void {
    this.showSaveConfirmModal.set(false);
    this.performSaveProfile();
  }

  closeProfileError(): void {
    this.showProfileError.set(false);
    this.profileErrorMessage.set('');
  }

  closeProfileSuccess(): void {
    this.showProfileSuccess.set(false);
    this.profileSuccessMessage.set('');
  }

  private performSaveProfile(): void {
    this.isLoading.set(true);

    const formValue = this.profileForm.getRawValue();
    const volunteerPreferenceKey = formValue.volunteerPreference ?? '';
    const availabilityName = this.getAvailabilityName(formValue.availability ?? '');

    // Build payload with proper handling of 'other' preference
    const isOtherPreference = volunteerPreferenceKey === 'other';
    const sanitizedOtherPreference = this.sanitizer.sanitizeInput(formValue.otherPreference ?? '', 'both');

    const payload = {
      firstName: this.sanitizer.sanitizeInput(formValue.firstName ?? '', 'both'),
      lastName: this.sanitizer.sanitizeInput(formValue.lastName ?? '', 'both'),
      facebookName: this.sanitizer.sanitizeInput(formValue.facebookName ?? '', 'both'),
      email: this.sanitizer.sanitizeInput(formValue.email ?? '', 'text'),
      mobileNumber: this.sanitizer.sanitizeInput(formValue.mobileNumber ?? '', 'text'),
      birthdate: formValue.birthdate ?? '',
      lastMedicalExam: formValue.lastMedicalExam ?? '',
      completeAddress: this.sanitizer.sanitizeInput(formValue.completeAddress ?? '', 'both'),
      educationalAttainment: this.sanitizer.sanitizeInput(formValue.educationalAttainment ?? '', 'both'),
      trainingExperience: this.sanitizer.sanitizeInput(formValue.trainingExperience ?? '', 'both'),
      skillsHobbies: this.sanitizer.sanitizeInput(formValue.skillsHobbies ?? '', 'both'),
      classesTraining: this.sanitizer.sanitizeInput(formValue.classesTraining ?? '', 'both'),
      // Send 'other' key when Other is selected, otherwise send the key (backend accepts both)
      volunteerPreference: volunteerPreferenceKey,
      // Only send otherPreference when volunteerPreference is 'other'
      otherPreference: isOtherPreference ? sanitizedOtherPreference : null,
      availability: availabilityName,
      otherAvailability: this.sanitizer.sanitizeInput(formValue.otherAvailability ?? '', 'both'),
      partOfLifegroup: formValue.partOfLifegroup ?? 'no',
      lifegroupLeaderName: this.sanitizer.sanitizeInput(formValue.lifegroupLeaderName ?? '', 'both'),
      leadingLifegroup: formValue.leadingLifegroup ?? 'no',
      emergencyContactName: this.sanitizer.sanitizeInput(formValue.emergencyContactName ?? '', 'both'),
      emergencyContactNumber: this.sanitizer.sanitizeInput(formValue.emergencyContactNumber ?? '', 'text'),
      emergencyContactRelationship: this.sanitizer.sanitizeInput(formValue.emergencyContactRelationship ?? '', 'both'),
    };

    this.volunteerService.updateProfile(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Update saved data first
          this.savedProfileData.set(response.data);

          // Apply to form while still enabled
          this.applyProfileResponse(response.data);

          // Exit edit mode and disable form
          this.isEditMode.set(false);
          this.profileForm.disable();
          this.closeAllCalendars();

          // Show success message
          this.showProfileSuccess.set(true);
          this.profileSuccessMessage.set('Profile updated successfully!');

          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            this.showProfileSuccess.set(false);
          }, 3000);
        } else {
          this.showProfileError.set(true);
          this.profileErrorMessage.set(response.message || 'Failed to update profile. Please try again.');
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('[ProfileComponent] Save profile error:', error);
        this.showProfileError.set(true);
        this.profileErrorMessage.set(error?.error?.message || 'An error occurred while saving. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  saveProfile(): void {
    if (!this.isEditMode()) {
      this.enterEditMode();
      return;
    }
    this.openSaveConfirmModal();
  }

  getControl(controlName: string): AbstractControl | null {
    return this.profileForm.get(controlName);
  }

  controlHasError(controlName: string): boolean {
    const control = this.getControl(controlName);
    if (!!control && control.invalid && (control.dirty || control.touched)) {
      return true;
    }

    if (
      controlName === 'confirmPassword' &&
      this.profileForm.hasError('passwordMismatch') &&
      (this.profileForm.get('confirmPassword')?.dirty || this.profileForm.get('confirmPassword')?.touched)
    ) {
      return true;
    }

    return false;
  }

  getControlError(controlName: string): string {
    const control = this.getControl(controlName);
    if (!control) return '';

    if (controlName === 'confirmPassword' && this.profileForm.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }

    if (!control.errors) return '';

    if (control.errors['required']) return 'This field is required';
    if (control.errors['email']) return 'Enter a valid email';
    if (control.errors['minlength']) return 'Input is too short';
    if (control.errors['maxlength']) return 'Input is too long';
    if (control.errors['pattern']) return 'Invalid format';
    if (control.errors['minLength']) return 'Password must be at least 8 characters';
    if (control.errors['requiresUppercase']) return 'Password needs uppercase letter';
    if (control.errors['requiresLowercase']) return 'Password needs lowercase letter';
    if (control.errors['requiresNumber']) return 'Password needs a number';
    if (control.errors['requiresSpecialChar']) return 'Password needs a special character';

    return 'Invalid field';
  }

  private getPositionKey(positionName: string): string {
    return this.positionToKeyMap[positionName] || positionName;
  }

  private getPositionName(positionKey: string): string {
    const reverseMap: Record<string, string> = {
      'sidewalk-sunday-school': 'Metro Sidewalk Sunday School (Teaching & Education)',
      'mobile-kitchen': 'Mobile Kitchen Operations',
      'relief-operations': 'Relief Operations',
      'safety-emergency': 'Safety and Emergency Response',
      'medical-operations': 'Medical Operations',
      'psychological-aid': 'Psychological First Aid',
      'transportation-logistics': 'Transportation & Logistics Team',
      'purchasing': 'Purchasing Team',
      'partnerships': 'Individual & Corporate Partnerships',
      'digital-marketing': 'Digital Marketing & Promotions',
      'creatives': 'Creatives (Video / Photos)',
      'healing': 'Healing',
      'real-estate-sports': 'Real Estate & Sports',
      'kitchen-related': 'Anything kitchen-related',
      'wherever-needed': 'Wherever is needed',
      'dont-know': "Don't know yet",
      'other': 'Other',
    };
    return reverseMap[positionKey] || positionKey;
  }

  private getAvailabilityKey(availabilityName: string): string {
    const map: Record<string, string> = {
      'Anytime / On Call': 'anytime',
      'Weekends Only': 'weekends-only',
      'Weekdays Only': 'weekdays-only',
      'Weekdays & Weekends': 'weekdays-weekends',
      'Friday & Saturday Only': 'friday-saturday',
      'Scheduled (By Arrangement)': 'scheduled',
      'Holidays (If Available)': 'holidays',
      'Rest Days / With Filed Leave': 'rest-days',
      'Limited Weekdays (Not Whole Day)': 'limited-weekdays',
      'Day Off Only': 'day-off',
      'Custom Availability': 'others',
    };
    return map[availabilityName] || availabilityName;
  }

  private getAvailabilityName(availabilityKey: string): string {
    const reverseMap: Record<string, string> = {
      'anytime': 'Anytime / On Call',
      'weekends-only': 'Weekends Only',
      'weekdays-only': 'Weekdays Only',
      'weekdays-weekends': 'Weekdays & Weekends',
      'friday-saturday': 'Friday & Saturday Only',
      'scheduled': 'Scheduled (By Arrangement)',
      'holidays': 'Holidays (If Available)',
      'rest-days': 'Rest Days / With Filed Leave',
      'limited-weekdays': 'Limited Weekdays (Not Whole Day)',
      'day-off': 'Day Off Only',
      'others': 'Custom Availability',
    };
    return reverseMap[availabilityKey] || availabilityKey;
  }
}
