import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../validators/password.validator';
import { AuthService } from '../services/auth.service';
import { VolunteerService } from '../services/volunteer.service';

import { VolunteerProfile, VolunteerProfileResponse } from '../models/volunteer-profile';
import { PollChoice } from '../models/poll-choice';
import { NotificationItem } from '../models/notification-item';
import { Attendance, AttendancePeriod } from '../models/attendance';

import { DatePipe } from '@angular/common';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './volunteer-dashboard.html',
  styleUrl: './volunteer-dashboard.scss',
})
export class VolunteerDashboard implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private volunteerService = inject(VolunteerService);

  readonly defaultPhoto = '/assets/volunteer1.png';

  currentView = signal<'overview' | 'profile' | 'schedule' | 'polls'>('overview');
  userName = signal(this.authService.currentUser()?.name || 'Volunteer');
  sidebarCollapsed = signal(false);
  isLoading = signal(false);

  // ── Attendance (real data) ───────────────────────────────────────────────
  attendancePeriod = signal<AttendancePeriod>('monthly');
  attendanceItems = signal<Attendance[]>([]);
  attendanceSearchQuery = signal('');

  attendanceTotalHours = signal(0);
  attendanceTotalEntries = signal(0);
  attendanceGoalHours = signal(40); // configurable monthly goal

  attendanceRate = computed(() => {
    const goal = this.attendanceGoalHours();
    if (goal === 0) {
      return 0;
    }
    return Math.min(100, Math.round((this.attendanceTotalHours() / goal) * 100));
  });

  // Keep legacy signals for overview card compatibility
  attendanceCount = computed(() => this.attendanceTotalHours());
  attendanceGoal = this.attendanceGoalHours;

  locationAssigned = signal('—');
  taskAssigned = signal('—');

  // ── Attendance form ──────────────────────────────────────────────────────
  showAddAttendance = signal(false);
  attendanceForm = this.fb.group({
    date: ['', [Validators.required]],
    hours: [null as number | null, [Validators.required, Validators.min(0.5), Validators.max(24)]],
    description: [''],
  });

  // ── Notifications ────────────────────────────────────────────────────────
  showNotifications = signal(false);
  showLogoutModal = signal(false);
  showOtherPreference = signal(false);
  searchQuery = signal('');
  notifications = signal<NotificationItem[]>([]);
  notificationCount = computed(
    () => this.notifications().filter((notification) => !notification.read).length,
  );

  // ── Polls ─────────────────────────────────────────────────────────────────
  selectedPollChoiceId = signal<number | null>(null);
  hasSubmittedVote = signal(false);

  pollChoices = signal<PollChoice[]>([]);

  totalVotes = computed(() => this.pollChoices().reduce((sum, choice) => sum + choice.votes, 0));

  selectedPollLabel = computed(() => {
    const selectedId = this.selectedPollChoiceId();
    const choice = this.pollChoices().find((item) => item.id === selectedId);
    return choice?.label ?? 'No vote submitted yet';
  });

  // ── Profile ───────────────────────────────────────────────────────────────
  editingProfileId = signal<number | null>(null);
  profilePreviewUrl = signal(this.defaultPhoto);
  profiles = signal<VolunteerProfile[]>([]);
  
  // Store the raw profile data from the backend for accurate completion calculation
  savedProfileData = signal<VolunteerProfileResponse | null>(null);

  // Success notification for profile updates
  showProfileSuccess = signal(false);
  profileSuccessMessage = signal('');

  // Confirmation modal for profile save
  showSaveConfirmModal = signal(false);

  // Error handling for profile updates
  showProfileError = signal(false);
  profileErrorMessage = signal('');

  // Map position names to dropdown keys for volunteer preference
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
  };

  profileForm = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      facebookName: [''],
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
      password: ['', [passwordStrengthValidator()]],
      confirmPassword: [''],
    },
    { validators: passwordMatchValidator('password', 'confirmPassword') },
  );

  profileCompletion = computed(() => {
    // Use savedProfileData from database for accurate completion calculation
    const savedData = this.savedProfileData();
    
    if (!savedData) {
      return 0;
    }
    
    // Required fields (9 total - each worth ~11.11%)
    const requiredFields = [
      savedData.first_name,
      savedData.last_name,
      savedData.email,
      savedData.mobile_number,
      savedData.birthdate,
      savedData.last_medical_examination,
      savedData.address,
      savedData.educational_attainment,
      savedData.positions?.length ? true : false,
    ];
    
    // Optional fields (4 total - each worth 2.5% bonus)
    const optionalFields = [
      savedData.facebook_name,
      savedData.training_experience,
      savedData.skills_hobbies,
      savedData.classes_training,
    ];
    
    // Count completed required fields
    let completedRequired = 0;
    for (const field of requiredFields) {
      if (field && String(field).trim().length > 0) {
        completedRequired++;
      }
    }
    
    // Count completed optional fields for bonus
    let completedOptional = 0;
    for (const field of optionalFields) {
      if (field && String(field).trim().length > 0) {
        completedOptional++;
      }
    }
    
    // Calculate percentage: required fields (90%) + optional bonus (10%)
    const requiredPercentage = (completedRequired / requiredFields.length) * 90;
    const optionalBonus = (completedOptional / optionalFields.length) * 10;
    
    return Math.min(100, Math.round(requiredPercentage + optionalBonus));
  });

  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadProfile();
    this.loadAttendanceStats();
    this.loadAttendance();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  private loadProfile(): void {
    this.volunteerService.getProfile().subscribe((response) => {
      if (response.success && response.data) {
        this.applyProfileResponse(response.data);
      }
    });
  }

  private applyProfileResponse(data: VolunteerProfileResponse): void {
    // Store the raw profile data for accurate completion calculation
    this.savedProfileData.set(data);
    
    this.userName.set(`${data.first_name} ${data.last_name}`.trim());

    // Map the first position as "task assigned" for the overview card
    if (data.positions?.length) {
      this.taskAssigned.set(data.positions.map((p) => p.name).join(', '));
    }

    // Get the position key for dropdown selection
    const positionName = data.positions?.[0]?.name ?? '';
    const positionKey = this.getPositionKey(positionName);

    // Populate the profile form with real data
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
    });

    // Show other preference field if position is 'other'
    this.showOtherPreference.set(positionKey === 'other');

    // Mirror into the profiles roster signal so the template shows the volunteer
    const existing = this.profiles();
    const profile: VolunteerProfile = {
      id: data.volunteer_id,
      firstName: data.first_name,
      lastName: data.last_name,
      facebookName: data.facebook_name ?? '',
      email: data.email,
      mobileNumber: data.mobile_number,
      birthdate: data.birthdate,
      lastMedicalExam: data.last_medical_examination,
      completeAddress: data.address,
      educationalAttainment: data.educational_attainment,
      trainingExperience: '',
      skillsHobbies: '',
      classesTraining: '',
      volunteerPreference: data.positions?.[0]?.name ?? '',
      otherPreference: '',
      photoUrl: this.defaultPhoto,
      positions: data.positions,
    };

    const idx = existing.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      this.profiles.update((items) => items.map((p, i) => (i === idx ? profile : p)));
    } else {
      this.profiles.update((items) => [profile, ...items]);
    }

    this.editingProfileId.set(data.volunteer_id);
  }

  private loadAttendanceStats(): void {
    this.volunteerService.getAttendanceStats().subscribe((response) => {
      if (response.success && response.data) {
        const stats = response.data;
        this.attendanceTotalHours.set(stats.monthly.hours);
        this.attendanceTotalEntries.set(stats.monthly.entries);
      }
    });
  }

  loadAttendance(): void {
    this.isLoading.set(true);
    this.volunteerService
      .getAttendance(this.attendancePeriod(), this.attendanceSearchQuery() || undefined)
      .subscribe((response) => {
        if (response.success) {
          this.attendanceItems.set(response.data ?? []);
        }
        this.isLoading.set(false);
      });
  }

  setAttendancePeriod(period: AttendancePeriod): void {
    this.attendancePeriod.set(period);
    this.loadAttendance();
  }

  searchAttendance(): void {
    this.loadAttendance();
  }

  // ── Sidebar / navigation ──────────────────────────────────────────────────

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  setView(view: 'overview' | 'profile' | 'schedule' | 'polls'): void {
    this.currentView.set(view);
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  runSearch(): void {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return;
    }

    if (query.includes('profile') || query.includes('name') || query.includes('signup')) {
      this.setView('profile');
      return;
    }

    if (query.includes('schedule') || query.includes('attendance') || query.includes('task')) {
      this.setView('schedule');
      return;
    }

    if (query.includes('poll') || query.includes('vote')) {
      this.setView('polls');
      return;
    }

    this.setView('overview');
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  toggleNotifications(): void {
    this.showNotifications.update((value) => !value);
  }

  markNotificationsRead(): void {
    this.notifications.update((items) => items.map((item) => ({ ...item, read: true })));
  }

  closeNotifications(): void {
    this.showNotifications.set(false);
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  openLogoutModal(): void {
    this.showLogoutModal.set(true);
  }

  closeLogoutModal(): void {
    this.showLogoutModal.set(false);
  }

  async confirmLogout(): Promise<void> {
    this.isLoading.set(true);
    this.showLogoutModal.set(false);
    try {
      await this.authService.logout();
    } finally {
      await this.router.navigate(['/login']);
      this.isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    this.openLogoutModal();
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

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
      (this.profileForm.get('confirmPassword')?.dirty ||
        this.profileForm.get('confirmPassword')?.touched)
    ) {
      return true;
    }

    return false;
  }

  getControlError(controlName: string): string {
    const control = this.getControl(controlName);
    if (!control) {
      return '';
    }

    if (controlName === 'confirmPassword' && this.profileForm.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }

    if (!control.errors) {
      return '';
    }

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

  // ── Polls ─────────────────────────────────────────────────────────────────

  selectPollChoice(choiceId: number): void {
    if (this.hasSubmittedVote()) {
      return;
    }

    this.selectedPollChoiceId.set(choiceId);
  }

  async submitPollVote(): Promise<void> {
    const selectedId = this.selectedPollChoiceId();
    if (selectedId === null || this.hasSubmittedVote()) {
      return;
    }

    this.isLoading.set(true);
    await new Promise((res) => setTimeout(res, 400));
    try {
      this.pollChoices.update((choices) =>
        choices.map((choice) => {
          if (choice.id === selectedId) {
            return { ...choice, votes: choice.votes + 1 };
          }
          return choice;
        }),
      );
      this.hasSubmittedVote.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  getVotePercentage(votes: number): number {
    const total = this.totalVotes();
    if (total === 0) {
      return 0;
    }

    return Math.round((votes / total) * 100);
  }

  // ── Photo ─────────────────────────────────────────────────────────────────

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

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

  // ── Profile CRUD ──────────────────────────────────────────────────────────

  // Open confirmation modal before saving
  openSaveConfirmModal(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.showSaveConfirmModal.set(true);
  }

  // Close save confirmation modal
  closeSaveConfirmModal(): void {
    this.showSaveConfirmModal.set(false);
  }

  // Confirm and save profile
  confirmSaveProfile(): void {
    this.showSaveConfirmModal.set(false);
    this.performSaveProfile();
  }

  // Close error modal
  closeProfileError(): void {
    this.showProfileError.set(false);
    this.profileErrorMessage.set('');
  }

  // Perform the actual profile save
  private performSaveProfile(): void {
    this.isLoading.set(true);

    const formValue = this.profileForm.getRawValue();
    
    // Convert position key to position name for the backend
    const volunteerPreferenceName = this.getPositionName(formValue.volunteerPreference ?? '');
    
    const payload = {
      firstName: formValue.firstName?.trim() ?? '',
      lastName: formValue.lastName?.trim() ?? '',
      facebookName: formValue.facebookName?.trim() ?? '',
      email: formValue.email?.trim() ?? '',
      mobileNumber: formValue.mobileNumber?.trim() ?? '',
      birthdate: formValue.birthdate ?? '',
      lastMedicalExam: formValue.lastMedicalExam ?? '',
      completeAddress: formValue.completeAddress?.trim() ?? '',
      educationalAttainment: formValue.educationalAttainment ?? '',
      trainingExperience: formValue.trainingExperience?.trim() ?? '',
      skillsHobbies: formValue.skillsHobbies?.trim() ?? '',
      classesTraining: formValue.classesTraining?.trim() ?? '',
      volunteerPreference: volunteerPreferenceName,
      otherPreference: formValue.otherPreference?.trim() ?? '',
    };

    this.volunteerService.updateProfile(payload).subscribe((response) => {
      if (response.success && response.data) {
        this.applyProfileResponse(response.data);
        // Show success notification
        this.showProfileSuccess.set(true);
        this.profileSuccessMessage.set('Profile updated successfully!');
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          this.showProfileSuccess.set(false);
          this.profileSuccessMessage.set('');
        }, 3000);
      } else {
        // Show error modal
        this.showProfileError.set(true);
        this.profileErrorMessage.set(response.message || 'Failed to update profile. Please try again.');
      }
      this.isLoading.set(false);
    });
  }

  // Keep saveProfile for backward compatibility
  async saveProfile(): Promise<void> {
    this.openSaveConfirmModal();
  }

  editProfile(profile: VolunteerProfile): void {
    this.editingProfileId.set(profile.id);
    this.profileForm.patchValue({
      firstName: profile.firstName,
      lastName: profile.lastName,
      facebookName: profile.facebookName,
      email: profile.email,
      mobileNumber: profile.mobileNumber,
      birthdate: profile.birthdate,
      lastMedicalExam: profile.lastMedicalExam,
      completeAddress: profile.completeAddress,
      educationalAttainment: profile.educationalAttainment,
      trainingExperience: profile.trainingExperience,
      skillsHobbies: profile.skillsHobbies,
      classesTraining: profile.classesTraining,
      volunteerPreference: profile.volunteerPreference,
      otherPreference: profile.otherPreference,
    });
    this.profilePreviewUrl.set(profile.photoUrl || this.defaultPhoto);
    this.showOtherPreference.set(profile.volunteerPreference === 'other');
  }

  cancelEdit(): void {
    this.editingProfileId.set(null);
    this.profileForm.reset();
    this.profilePreviewUrl.set(this.defaultPhoto);
    this.showOtherPreference.set(false);
  }

  async deleteProfile(profileId: number): Promise<void> {
    this.isLoading.set(true);
    await new Promise((res) => setTimeout(res, 400));
    try {
      this.profiles.update((items) => items.filter((item) => item.id !== profileId));

      if (this.editingProfileId() === profileId) {
        this.cancelEdit();
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  onVolunteerPreferenceChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.showOtherPreference.set(value === 'other');
    if (value !== 'other') {
      this.profileForm.patchValue({ otherPreference: '' });
    }
  }

  getProfileDisplayName(profile: VolunteerProfile): string {
    return `${profile.firstName} ${profile.lastName}`.trim();
  }

  // Helper method to convert position name to dropdown key
  private getPositionKey(positionName: string): string {
    return this.positionToKeyMap[positionName] || positionName;
  }

  // Helper method to convert dropdown key to position name for saving
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
    };
    return reverseMap[positionKey] || positionKey;
  }

  // ── Attendance form ───────────────────────────────────────────────────────

  toggleAddAttendance(): void {
    this.showAddAttendance.update((v) => !v);
    if (!this.showAddAttendance()) {
      this.attendanceForm.reset();
    }
  }

  submitAttendance(): void {
    if (this.attendanceForm.invalid) {
      this.attendanceForm.markAllAsTouched();
      return;
    }

    const value = this.attendanceForm.getRawValue();
    this.isLoading.set(true);

    this.volunteerService
      .createAttendance({
        date: value.date ?? '',
        hours: value.hours ?? 0,
        description: value.description ?? undefined,
      })
      .subscribe((response) => {
        if (response.success) {
          this.attendanceForm.reset();
          this.showAddAttendance.set(false);
          this.loadAttendance();
          this.loadAttendanceStats();
        }
        this.isLoading.set(false);
      });
  }

  getAttendanceStatusClass(status: string): string {
    if (status === 'approved') return 'confirmed';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  }
}
