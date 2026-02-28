import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { passwordMatchValidator, passwordStrengthValidator } from '../validators/password.validator';

import { VolunteerProfile } from '../models/volunteer-profile';
import { PollChoice } from '../models/poll-choice';
import { NotificationItem } from '../models/notification-item';

@Component({
  selector: 'app-volunteer-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './volunteer-dashboard.html',
  styleUrl: './volunteer-dashboard.scss',
})
export class VolunteerDashboard {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  readonly defaultPhoto = '/assets/volunteer1.png';

  currentView = signal<'overview' | 'profile' | 'schedule' | 'polls'>('overview');
  userName = signal('Jasmine Deleon');
  sidebarCollapsed = signal(false);
  showNotifications = signal(false);
  showLogoutModal = signal(false);
  showOtherPreference = signal(false);
  searchQuery = signal('');
  notifications = signal<NotificationItem[]>([
    {
      id: 1,
      title: 'Attendance Updated',
      description: 'Your attendance for the latest activity is now recorded.',
      time: '2h ago',
      read: false,
    },
    {
      id: 2,
      title: 'Poll Reminder',
      description: 'Please submit your preferred volunteer schedule.',
      time: '5h ago',
      read: false,
    },
    {
      id: 3,
      title: 'Profile Review',
      description: 'Update your profile details for this month.',
      time: '1d ago',
      read: false,
    },
  ]);
  notificationCount = computed(
    () => this.notifications().filter(notification => !notification.read).length
  );

  attendanceCount = signal(18);
  attendanceGoal = signal(24);
  locationAssigned = signal('NLCOM Relief Hub, Quezon City');
  taskAssigned = signal('Food pack sorting and distribution support');

  selectedPollChoiceId = signal<number | null>(null);
  hasSubmittedVote = signal(false);

  pollChoices = signal<PollChoice[]>([
    { id: 1, label: 'Morning Shift (6:00 AM - 12:00 PM)', votes: 10 },
    { id: 2, label: 'Midday Shift (12:00 PM - 4:00 PM)', votes: 7 },
    { id: 3, label: 'Afternoon Shift (4:00 PM - 8:00 PM)', votes: 5 },
  ]);

  totalVotes = computed(() => this.pollChoices().reduce((sum, choice) => sum + choice.votes, 0));

  attendanceRate = computed(() => {
    const goal = this.attendanceGoal();
    if (goal === 0) {
      return 0;
    }

    return Math.round((this.attendanceCount() / goal) * 100);
  });

  selectedPollLabel = computed(() => {
    const selectedId = this.selectedPollChoiceId();
    const choice = this.pollChoices().find(item => item.id === selectedId);
    return choice?.label ?? 'No vote submitted yet';
  });

  editingProfileId = signal<number | null>(null);
  profilePreviewUrl = signal(this.defaultPhoto);
  profiles = signal<VolunteerProfile[]>([
    {
      id: 1,
      firstName: 'Jasmine',
      lastName: 'Deleon',
      facebookName: 'Jasmine D.',
      email: 'jasmine.deleon@example.com',
      mobileNumber: '09171234567',
      birthdate: '1998-04-12',
      lastMedicalExam: '2025-08-15',
      completeAddress: 'Quezon City, Metro Manila',
      educationalAttainment: 'college-graduate',
      trainingExperience: 'Relief operations, first aid support',
      skillsHobbies: 'Community outreach, logistics, communications',
      classesTraining: 'Disaster preparedness, emergency response',
      volunteerPreference: 'mobile-kitchen',
      otherPreference: '',
      password: 'Pass@1234',
      confirmPassword: 'Pass@1234',
      photoUrl: this.defaultPhoto,
    },
  ]);

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
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator('password', 'confirmPassword') }
  );

  profileCompletion = computed(() => {
    const form = this.profileForm;
    const requiredControls = [
      'firstName',
      'lastName',
      'email',
      'mobileNumber',
      'birthdate',
      'lastMedicalExam',
      'completeAddress',
      'educationalAttainment',
      'volunteerPreference',
      'password',
      'confirmPassword',
    ];
    const completed = requiredControls.filter(controlName => !!form.get(controlName)?.value).length;
    return Math.round((completed / requiredControls.length) * 100);
  });

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
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

  toggleNotifications(): void {
    this.showNotifications.update(value => !value);
  }

  markNotificationsRead(): void {
    this.notifications.update(items => items.map(item => ({ ...item, read: true })));
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
    this.showLogoutModal.set(false);
    await this.router.navigate(['/login']);
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
      (this.profileForm.get('confirmPassword')?.dirty || this.profileForm.get('confirmPassword')?.touched)
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

  selectPollChoice(choiceId: number): void {
    if (this.hasSubmittedVote()) {
      return;
    }

    this.selectedPollChoiceId.set(choiceId);
  }

  submitPollVote(): void {
    const selectedId = this.selectedPollChoiceId();
    if (selectedId === null || this.hasSubmittedVote()) {
      return;
    }

    this.pollChoices.update(choices =>
      choices.map(choice => {
        if (choice.id === selectedId) {
          return { ...choice, votes: choice.votes + 1 };
        }

        return choice;
      })
    );

    this.hasSubmittedVote.set(true);
  }

  getVotePercentage(votes: number): number {
    const total = this.totalVotes();
    if (total === 0) {
      return 0;
    }

    return Math.round((votes / total) * 100);
  }

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
    };

    reader.readAsDataURL(file);
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const formValue = this.profileForm.getRawValue();
    const profilePayload: Omit<VolunteerProfile, 'id'> = {
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
      volunteerPreference: formValue.volunteerPreference ?? '',
      otherPreference: formValue.otherPreference?.trim() ?? '',
      password: formValue.password ?? '',
      confirmPassword: formValue.confirmPassword ?? '',
      photoUrl: this.profilePreviewUrl(),
    };

    const editingId = this.editingProfileId();
    if (editingId !== null) {
      this.profiles.update(items =>
        items.map(item => (item.id === editingId ? { id: editingId, ...profilePayload } : item))
      );
      if (editingId === 1) {
        this.userName.set(`${profilePayload.firstName} ${profilePayload.lastName}`.trim());
      }
      this.cancelEdit();
      return;
    }

    const createdProfile: VolunteerProfile = {
      id: Date.now(),
      ...profilePayload,
    };

    this.profiles.update(items => [createdProfile, ...items]);
    this.profileForm.reset();
    this.profilePreviewUrl.set(this.defaultPhoto);
    this.showOtherPreference.set(false);
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
      password: profile.password,
      confirmPassword: profile.confirmPassword,
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

  deleteProfile(profileId: number): void {
    this.profiles.update(items => items.filter(item => item.id !== profileId));

    if (this.editingProfileId() === profileId) {
      this.cancelEdit();
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
}
