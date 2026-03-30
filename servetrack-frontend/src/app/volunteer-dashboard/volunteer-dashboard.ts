import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  DestroyRef,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../validators/password.validator';
import { AuthService } from '../services/auth.service';
import { VolunteerService } from '../services/volunteer.service';
import { PollService } from '../services/poll.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { InputSanitizerService } from '../services/input-sanitizer.service';
import { DatePipe, TitleCasePipe } from '@angular/common';

import { VolunteerProfile, VolunteerProfileResponse } from '../models/volunteer-profile';
import { Poll, PollOption } from '../models/poll';
import { NotificationItem } from '../models/notification-item';
import { Attendance, AttendancePeriod } from '../models/attendance';
import { VolunteerPoll } from '../models/volunteer-poll';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, TitleCasePipe],
  templateUrl: './volunteer-dashboard.html',
  styleUrl: './volunteer-dashboard.scss',
})
export class VolunteerDashboard implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private volunteerService = inject(VolunteerService);
  private pollService = inject(PollService);
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(InputSanitizerService);

  readonly defaultPhoto = '/assets/volunteer1.png';

  // ── Navigation State (Fixed menu close issue) ────────────────────────────
  currentView = signal<'overview' | 'profile' | 'schedule' | 'polls' | 'rsvps'>('overview');
  userName = signal(this.authService.currentUser()?.name || 'Volunteer');
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);
  isMobile = signal(false);

  isLoading = signal(false);

  // ── Real-time Clock ──────────────────────────────────────────────────────
  currentTime = signal(new Date());
  currentDateFormatted = computed(() => {
    const date = this.currentTime();
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  });

  currentTimeFormatted = computed(() => {
    const date = this.currentTime();
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  });

  private timeUpdateInterval: any;

  // ── Attendance (real data) ───────────────────────────────────────────────
  attendancePeriod = signal<AttendancePeriod>('monthly');
  attendanceItems = signal<Attendance[]>([]);
  attendanceSearchQuery = signal('');

  attendanceTotalHours = signal(0);
  attendanceTotalEntries = signal(0);
  attendanceGoalHours = signal(40);

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

  showNotifications = signal(false);
  showLogoutModal = signal(false);
  showOtherPreference = signal(false);
  searchQuery = signal('');
  notifications = signal<NotificationItem[]>([]);
  notificationCount = computed(
    () => this.notifications().filter((n) => !n.read).length,
  );

  polls = signal<Poll[]>([]);
  activePoll = signal<Poll | null>(null);
  selectedOptionId = signal<number | null>(null);
  hasSubmittedVote = signal(false);
  pollError = signal<string | null>(null);

// ── Profile ───────────────────────────────────────────────────────────────
  editingProfileId = signal<number | null>(null);
  isEditMode = signal(false);
  profilePreviewUrl = signal(this.defaultPhoto);
  profiles = signal<VolunteerProfile[]>([]);
  savedProfileData = signal<VolunteerProfileResponse | null>(null);
  
  // Accordion state for compact profile layout
  expandedSection = signal<'personal' | 'service' | 'emergency' | null>('personal');
  profileErrorMessage = signal('');

  // Profile modal and success/error states
  showSaveConfirmModal = signal(false);
  showProfileError = signal(false);
  showProfileSuccess = signal(false);
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

  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.updateIsMobile();
    this.startRealTimeClock();
    this.loadProfile();
    this.loadAttendanceStats();
    this.loadAttendance();
    this.loadPolls();
  }

  private startRealTimeClock(): void {
    // Update immediately
    this.currentTime.set(new Date());

    // Update every second
    this.timeUpdateInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    // Clean up on destroy
    this.destroyRef.onDestroy(() => {
      if (this.timeUpdateInterval) {
        clearInterval(this.timeUpdateInterval);
      }
    });
  }

  // ── Screen Detection for Mobile/Desktop Behavior ─────────────────────────
  private updateIsMobile(): void {
    const checkMobile = () => {
      this.isMobile.set(window.innerWidth <= 860);
    };
    checkMobile();
    // Listen for resize (debounced)
    let timeout: any;
    window.addEventListener('resize', () => {
      clearTimeout(timeout);
      timeout = setTimeout(checkMobile, 100);
    });
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  private loadProfile(): void {
    this.volunteerService.getProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
      if (response.success && response.data) {
        this.applyProfileResponse(response.data);
        // Default to view mode after load
        if (!this.isEditMode()) {
          this.profileForm.markAsPristine();
        }
      }
    });
  }

  private applyProfileResponse(data: VolunteerProfileResponse): void {
    this.savedProfileData.set(data);
    this.userName.set(`${data.first_name} ${data.last_name}`.trim());

    if (data.positions?.length) {
      this.taskAssigned.set(data.positions.map((p) => p.name).join(', '));
    }

    const positionName = data.positions?.[0]?.name ?? '';
    const positionKey = this.getPositionKey(positionName);

    const availabilityName = data.availabilities?.[0]?.name ?? '';
    const otherAvailability = data.availabilities?.[0]?.pivot?.custom_description ?? '';
    const availabilityKey = this.getAvailabilityKey(availabilityName);

    const isPartLifegroup = data.lifegroups?.length ? 'yes' : 'no';
    const isLeader = data.lifegroups?.[0]?.pivot?.is_leader ? 'yes' : 'no';

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
      leadingLifegroup: isLeader,
      emergencyContactName: data.emergency_contact?.name ?? '',
      emergencyContactNumber: data.emergency_contact?.phone_number ?? '',
      emergencyContactRelationship: data.emergency_contact?.relationship ?? '',
    });

    this.showOtherPreference.set(positionKey === 'other');

    // Disable form controls since we're in view mode by default
    this.profileForm.disable();

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
    this.volunteerService.getAttendanceStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
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
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((response) => {
        if (response.success) {
          this.attendanceItems.set(response.data ?? []);
        }
        this.isLoading.set(false);
      });
  }

  private loadPolls(): void {
    this.pollService.getPolls().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
      const active = response.data.filter((p) => p.status === 'active');
      this.polls.set(active);
      if (active.length > 0 && !this.activePoll()) {
        this.setActivePoll(active[0]);
      }
    });
  }

  private loadRsvps(): void {
    // Placeholder for RSVP loading functionality
    // This would load RSVP data from a service
  }

  setActivePoll(poll: Poll): void {
    this.activePoll.set(poll);
    this.selectedOptionId.set(null);
    this.hasSubmittedVote.set(false);
    this.pollError.set(null);
  }

  setAttendancePeriod(period: AttendancePeriod): void {
    this.attendancePeriod.set(period);
    this.loadAttendance();
  }

  searchAttendance(query: string): void {
    this.attendanceSearchQuery.set(query);
    this.loadAttendance();
  }

  onPeriodChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.setAttendancePeriod(select.value as AttendancePeriod);
  }

  // ── Sidebar / navigation (Fixed close-on-select + mobile overlay) ───────

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileSidebarOpen.update((v) => !v);
    } else {
      this.sidebarCollapsed.update((v) => !v);
    }
  }

  setView(view: 'overview' | 'profile' | 'schedule' | 'polls' | 'rsvps'): void {
    this.currentView.set(view);
    // Removed auto-closing per user request - sidebar stays open
  }

  onOverlayClick(): void {
    this.mobileSidebarOpen.set(false);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((value) => !value);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
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

  toggleNotifications(): void {
    this.showNotifications.update((value) => !value);
  }

  markNotificationsRead(): void {
    this.notifications.update((items) => items.map((item) => ({ ...item, read: true })));
  }

  closeNotifications(): void {
    this.showNotifications.set(false);
  }

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

  selectOption(optionId: number): void {
    const poll = this.activePoll();
    if (!poll || this.hasSubmittedVote()) return;
    const option = poll.options.find((o) => o.id === optionId);
    if (option && option.votes < option.capacity) {
      this.selectedOptionId.set(optionId);
    }
  }

  submitPollVote(): void {
    const poll = this.activePoll();
    const optionId = this.selectedOptionId();
    if (!poll || optionId === null || this.hasSubmittedVote()) return;

    this.isLoading.set(true);
    this.pollError.set(null);
    this.pollService.vote(poll.id, optionId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.hasSubmittedVote.set(true);
        this.isLoading.set(false);
        this.loadPolls();
      },
      error: (err: { error?: { message?: string } }) => {
        this.pollError.set(err?.error?.message ?? 'Failed to submit vote. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  getVotePercentage(option: PollOption, poll?: Poll): number {
    const p = poll || this.activePoll();
    if (!p || p.totalVotes === 0) {
      return 0;
    }
    return Math.round((option.votes / p.totalVotes) * 100);
  }

  getRemainingSlots(option: PollOption): number {
    return option.capacity - option.votes;
  }

  isOptionFull(option: PollOption): boolean {
    return option.votes >= option.capacity;
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

  // Close success modal
  closeProfileSuccess(): void {
    this.showProfileSuccess.set(false);
    this.profileSuccessMessage.set('');
  }

  // Perform the actual profile save
  private performSaveProfile(): void {
    this.isLoading.set(true);

    const formValue = this.profileForm.getRawValue();

    // Convert keys to names for the backend
    const volunteerPreferenceName = this.getPositionName(formValue.volunteerPreference ?? '');
    const availabilityName = this.getAvailabilityName(formValue.availability ?? '');

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
      volunteerPreference: volunteerPreferenceName,
      otherPreference: this.sanitizer.sanitizeInput(formValue.otherPreference ?? '', 'both'),
      availability: availabilityName,
      otherAvailability: this.sanitizer.sanitizeInput(formValue.otherAvailability ?? '', 'both'),
      partOfLifegroup: formValue.partOfLifegroup ?? 'no',
      lifegroupLeaderName: this.sanitizer.sanitizeInput(formValue.lifegroupLeaderName ?? '', 'both'),
      leadingLifegroup: formValue.leadingLifegroup ?? 'no',
      emergencyContactName: this.sanitizer.sanitizeInput(formValue.emergencyContactName ?? '', 'both'),
      emergencyContactNumber: this.sanitizer.sanitizeInput(formValue.emergencyContactNumber ?? '', 'text'),
      emergencyContactRelationship: this.sanitizer.sanitizeInput(formValue.emergencyContactRelationship ?? '', 'both'),
    };

    this.volunteerService.updateProfile(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
      if (response.success && response.data) {
        this.applyProfileResponse(response.data);
        // Show success modal
        this.showProfileSuccess.set(true);
        this.profileSuccessMessage.set('Profile updated successfully!');
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
    if (!this.isEditMode()) {
      this.enterEditMode();
      return;
    }
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

  enterEditMode(): void {
    this.isEditMode.set(true);
    this.profileForm.enable();
    this.profileForm.markAllAsTouched();
  }

  exitEditMode(cancel: boolean = false): void {
    this.isEditMode.set(false);
    this.profileForm.disable();
    if (cancel) {
      // Reset form to saved profile data
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
          leadingLifegroup: savedData.lifegroups?.[0]?.pivot?.is_leader ? 'yes' : 'no',

          lifegroupLeaderName: '',
          emergencyContactName: savedData.emergency_contact?.name ?? '',

          emergencyContactNumber: savedData.emergency_contact?.phone_number ?? '',
          emergencyContactRelationship: savedData.emergency_contact?.relationship ?? '',
        });
        this.profilePreviewUrl.set(this.defaultPhoto);
      }
      this.profileForm.markAsPristine();
    }
  }

  toggleEditMode(): void {
    if (this.isEditMode()) {
      this.exitEditMode(true); // Cancel changes
    } else {
      this.enterEditMode();
    }
  }

  toggleSection(section: 'personal' | 'service' | 'emergency'): void {
    if (this.expandedSection() === section) {
      this.expandedSection.set(null);
    } else {
      this.expandedSection.set(section);
    }
  }

  cancelEdit(): void {
    this.exitEditMode(true);
    this.editingProfileId.set(null);
    this.showOtherPreference.set(false);
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

  // Helper method to convert availability name to dropdown key
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

  // Helper method to convert dropdown key to availability name for saving
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

  // ── Attendance form ───────────────────────────────────────────────────────

  getAttendanceStatusClass(status: string): string {
    if (status === 'approved') return 'confirmed';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  }
}
