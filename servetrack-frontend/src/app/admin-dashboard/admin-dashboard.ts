import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { DatePipe, CommonModule } from '@angular/common';
import { NotificationItem } from '../models/notification-item';
import { PerformanceMetric } from '../models/performance-metric';
import { AdminDashboardService, DashboardVolunteerRow } from '../services/admin-dashboard.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Poll, PollOption } from '../models/poll';
import { PollService } from '../services/poll.service';
import { IncidentCommandSystemComponent } from '../incident-command-system/incident-command-system';
import { User } from '../models/user';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, CommonModule, IncidentCommandSystemComponent],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private adminDashboardService = inject(AdminDashboardService);
  private destroyRef = inject(DestroyRef);
  private pollService = inject(PollService);
  private userService = inject(UserService);

  readonly defaultPhoto = '/assets/nlcom.png';

  currentView = signal<'overview' | 'volunteers' | 'attendance' | 'performance' | 'polls' | 'ics' | 'users' | 'analytics' | 'events' | 'sms' | 'backup'>('overview');
  userName = signal(this.authService.currentUser()?.name || 'Admin');
  sidebarCollapsed = signal(false);
  isLoading = signal(false);

  showNotifications = signal(false);
  showLogoutModal = signal(false);
  showPollModal = signal(false);
  showDeletePollModal = signal(false);
  showVolunteerModal = signal(false);
  showDeleteVolunteerModal = signal(false);
  showUserModal = signal(false);
  showDeleteUserModal = signal(false);
  showResetPasswordModal = signal(false);

  searchQuery = signal('');
  userSearchQuery = signal('');
  userRoleFilter = signal('');

  editingPoll = signal<Poll | null>(null);
  deletingPollId = signal<number | null>(null);
  editingVolunteer = signal<DashboardVolunteerRow | null>(null);
  deletingVolunteerId = signal<number | null>(null);
  editingUser = signal<User | null>(null);
  deletingUserId = signal<number | null>(null);
  resettingPasswordUserId = signal<number | null>(null);

  showAiModal = signal(false);
  currentPage = signal(1);

  notifications = signal<NotificationItem[]>([]);

  notificationCount = computed(
    () => this.notifications().filter((notification) => !notification.read).length,
  );

  totalVolunteers = signal(0);
  activeVolunteers = signal(0);
  upcomingEvents = signal(0);
  completedMissions = signal(0);

  volunteerRows = signal<DashboardVolunteerRow[]>([]);
  performanceMetrics = signal<PerformanceMetric[]>([]);
  polls = signal<Poll[]>([]);
  pollFilterStatus = signal<'all' | 'active' | 'closed' | 'draft'>('all');
  users = signal<User[]>([]);

  sortField = signal<'name' | 'attendance' | 'hours' | 'tasks' | 'rating'>('attendance');
  sortDirection = signal<'asc' | 'desc'>('desc');

  sortedPerformanceMetrics = computed(() => {
    const metrics = [...this.performanceMetrics()];
    const field = this.sortField();
    const direction = this.sortDirection();

    metrics.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (field) {
        case 'name':
          aVal = a.volunteerName;
          bVal = b.volunteerName;
          break;
        case 'attendance':
          aVal = a.attendanceRate;
          bVal = b.attendanceRate;
          break;
        case 'hours':
          aVal = a.hoursServed;
          bVal = b.hoursServed;
          break;
        case 'tasks':
          aVal = a.tasksCompleted;
          bVal = b.tasksCompleted;
          break;
        case 'rating':
          aVal = a.rating;
          bVal = b.rating;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return direction === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return metrics;
  });

  averageAttendanceRate = computed(() => {
    const metrics = this.performanceMetrics();
    if (metrics.length === 0) {
      return 0;
    }
    const total = metrics.reduce((sum, m) => sum + m.attendanceRate, 0);
    return Math.round(total / metrics.length);
  });

  totalHoursServed = computed(() => {
    return this.performanceMetrics().reduce((sum, m) => sum + m.hoursServed, 0);
  });

  totalTasksCompleted = computed(() => {
    return this.performanceMetrics().reduce((sum, m) => sum + m.tasksCompleted, 0);
  });

  averageRating = computed(() => {
    const metrics = this.performanceMetrics();
    if (metrics.length === 0) {
      return 0;
    }
    const total = metrics.reduce((sum, m) => sum + m.rating, 0);
    return (total / metrics.length).toFixed(1);
  });

  filteredPolls = computed(() => {
    const status = this.pollFilterStatus();
    if (status === 'all') {
      return this.polls();
    }
    return this.polls().filter((poll) => poll.status === status);
  });

  filteredUsers = computed(() => {
    let filtered = this.users();
    const role = this.userRoleFilter();
    const search = this.userSearchQuery().toLowerCase().trim();

    if (role) {
      filtered = filtered.filter(u => u.role === role);
    }
    if (search) {
      filtered = filtered.filter(u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
    }
    return filtered;
  });

  pollForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    date: ['', Validators.required],
    cutOffDay: ['', Validators.required],
    cutOffTime: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
    options: this.fb.array([]),
  });

  volunteerForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    facebookName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
    birthdate: ['', Validators.required],
    lastMedicalExam: ['', Validators.required],
    completeAddress: ['', Validators.required],
    educationalAttainment: ['', Validators.required],
    trainingExperience: [''],
    skillsHobbies: [''],
    classesTraining: [''],
    volunteerPreference: ['', Validators.required],
    otherPreference: [''],
    availability: ['', Validators.required],
    otherAvailability: [''],
    partOfLifegroup: ['', Validators.required],
    lifegroupLeaderName: [''],
    leadingLifegroup: ['', Validators.required],
    emergencyContactName: ['', Validators.required],
    emergencyContactNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
    emergencyContactRelationship: ['', Validators.required],
  });

  userForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['', Validators.required],
    password: [''],
    confirmPassword: [''],
  });

  resetPasswordForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadPolls();
    this.loadUsers();
  }

  private loadDashboardData(): void {
    this.isLoading.set(true);

    this.adminDashboardService.getDashboardData().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
      if (response.success && response.data) {
        this.totalVolunteers.set(response.data.stats.totalVolunteers);
        this.activeVolunteers.set(response.data.stats.activeVolunteers);
        this.upcomingEvents.set(response.data.stats.upcomingEvents);
        this.completedMissions.set(response.data.stats.completedMissions);
        this.notifications.set(response.data.notifications ?? []);
        this.volunteerRows.set(response.data.volunteers ?? []);
        this.performanceMetrics.set(response.data.performanceMetrics ?? []);
      } else {
        this.notifications.set([]);
        this.volunteerRows.set([]);
        this.performanceMetrics.set([]);
      }

      this.isLoading.set(false);
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  setView(view: 'overview' | 'volunteers' | 'attendance' | 'performance' | 'polls' | 'ics' | 'users' | 'analytics' | 'events' | 'sms' | 'backup'): void {
    this.currentView.set(view);
    this.currentPage.set(1);
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  runSearch(): void {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return;
    }

    if (query.includes('volunteer')) {
      this.setView('volunteers');
      return;
    }

    if (query.includes('attendance')) {
      this.setView('attendance');
      return;
    }

    if (query.includes('performance')) {
      this.setView('performance');
      return;
    }

    if (query.includes('poll')) {
      this.setView('polls');
      return;
    }

    if (query.includes('incident') || query.includes('ics') || query.includes('command')) {
      this.setView('ics');
      return;
    }

    if (query.includes('user')) {
      this.setView('users');
      return;
    }

    if (query.includes('analytic')) {
      this.setView('analytics');
      return;
    }

    if (query.includes('event')) {
      this.setView('events');
      return;
    }

    if (query.includes('sms') || query.includes('message')) {
      this.setView('sms');
      return;
    }

    if (query.includes('backup') || query.includes('restore')) {
      this.setView('backup');
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

  openAiModal(): void {
    this.showAiModal.set(true);
  }

  closeAiModal(): void {
    this.showAiModal.set(false);
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe((response) => {
      if (response.success) {
        this.users.set(response.data);
      }
    });
  }

  setUserSearchQuery(query: string): void {
    this.userSearchQuery.set(query);
  }

  setUserRoleFilter(role: string): void {
    this.userRoleFilter.set(role);
  }

  openCreateUserModal(): void {
    this.editingUser.set(null);
    this.userForm.reset({
      name: '',
      email: '',
      role: '',
      password: '',
      confirmPassword: ''
    });
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    this.userForm.get('confirmPassword')?.setValidators(Validators.required);
    this.userForm.get('password')?.updateValueAndValidity();
    this.userForm.get('confirmPassword')?.updateValueAndValidity();
    this.showUserModal.set(true);
  }

  openEditUserModal(user: User): void {
    this.editingUser.set(user);
    this.userForm.reset();
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('confirmPassword')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.userForm.get('confirmPassword')?.updateValueAndValidity();
    this.userForm.patchValue({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    this.showUserModal.set(true);
  }

  closeUserModal(): void {
    this.showUserModal.set(false);
    this.editingUser.set(null);
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const val = this.userForm.value;
    const editingUser = this.editingUser();

    if (!editingUser) {
      if (val.password !== val.confirmPassword) {
        this.userForm.get('confirmPassword')?.setErrors({ mismatch: true });
        return;
      }
      this.userService.createUser({
        name: val.name!,
        email: val.email!,
        role: val.role as any,
        password: val.password!
      }).subscribe(() => {
        this.loadUsers();
        this.closeUserModal();
      });
    } else {
      this.userService.updateUser(editingUser.id, {
        name: val.name!,
        email: val.email!,
        role: val.role as any,
      }).subscribe(() => {
        this.loadUsers();
        this.closeUserModal();
      });
    }
  }

  confirmDeleteUser(userId: number): void {
    this.deletingUserId.set(userId);
    this.showDeleteUserModal.set(true);
  }

  closeDeleteUserModal(): void {
    this.showDeleteUserModal.set(false);
    this.deletingUserId.set(null);
  }

  deleteUser(): void {
    const id = this.deletingUserId();
    if (id !== null) {
      this.userService.deleteUser(id).subscribe(() => {
        this.loadUsers();
        this.closeDeleteUserModal();
      });
    }
  }

  openResetPasswordModal(userId: number): void {
    this.resettingPasswordUserId.set(userId);
    this.resetPasswordForm.reset();
    this.showResetPasswordModal.set(true);
  }

  closeResetPasswordModal(): void {
    this.showResetPasswordModal.set(false);
    this.resettingPasswordUserId.set(null);
  }

  resetPassword(): void {
    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    const val = this.resetPasswordForm.value;
    if (val.password !== val.confirmPassword) {
      this.resetPasswordForm.get('confirmPassword')?.setErrors({ mismatch: true });
      return;
    }

    const id = this.resettingPasswordUserId();
    if (id !== null) {
      this.userService.resetPassword(id, val.password!).subscribe(() => {
        this.closeResetPasswordModal();
      });
    }
  }

  async confirmLogout(): Promise<void> {
    this.isLoading.set(true);
    this.showLogoutModal.set(false);
    await this.router.navigate(['/login']);
    this.isLoading.set(false);
  }

  async logout(): Promise<void> {
    this.openLogoutModal();
  }

  sortBy(field: 'name' | 'attendance' | 'hours' | 'tasks' | 'rating'): void {
    if (this.sortField() === field) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }
  }

  getRatingStars(rating: number): string {
    return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
  }

  getPerformanceLevel(attendanceRate: number): string {
    if (attendanceRate >= 90) {
      return 'Excellent';
    }
    if (attendanceRate >= 80) {
      return 'Good';
    }
    if (attendanceRate >= 70) {
      return 'Fair';
    }
    return 'Needs Improvement';
  }

  getPerformanceLevelClass(attendanceRate: number): string {
    if (attendanceRate >= 90) {
      return 'level-excellent';
    }
    if (attendanceRate >= 80) {
      return 'level-good';
    }
    if (attendanceRate >= 70) {
      return 'level-fair';
    }
    return 'level-needs-improvement';
  }

  private loadPolls(): void {
    this.pollService.getPolls().subscribe((response) => {
      this.polls.set(response.data);
    });
  }

  get pollOptions(): FormArray {
    return this.pollForm.get('options') as FormArray;
  }

  openCreatePollModal(): void {
    this.editingPoll.set(null);
    this.pollForm.reset();
    this.pollOptions.clear();
    this.addPollOption();
    this.addPollOption();
    this.showPollModal.set(true);
  }

  openEditPollModal(poll: Poll): void {
    this.editingPoll.set(poll);
    this.pollOptions.clear();
    
    poll.options.forEach((option) => {
      this.pollOptions.push(
        this.fb.group({
          timeSlot: [option.timeSlot, Validators.required],
          capacity: [option.capacity, [Validators.required, Validators.min(1)]],
        })
      );
    });

    // Convert backend date strings to date input format (YYYY-MM-DD)
    const parseBackendDate = (dateString: string): string => {
      if (!dateString) return '';
      // If it's already in YYYY-MM-DD format, return as-is
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
      }
     
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; 
    };

    // Convert backend time strings to time input format (HH:MM)
    const parseBackendTime = (timeString: string): string => {
      if (!timeString) return '';
      // Handle HH:MM:SS format from MySQL TIME column
      if (timeString.match(/^\d{2}:\d{2}:\d{2}$/)) {
        return timeString.substring(0, 5); 
      }
     
      const timeMatch = timeString.match(/(\d{1,2}):(\d{2})(AM|PM)/i);
      if (timeMatch) {
        let [, hours, minutes, ampm] = timeMatch;
        let hour = parseInt(hours);
        if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:${minutes}`;
      }
      return '';
    };

    this.pollForm.patchValue({
      title: poll.title,
      date: parseBackendDate(poll.date),
      cutOffDay: parseBackendDate(poll.cutOffDay),
      cutOffTime: parseBackendTime(poll.cutOffTime),
      description: poll.description,
    });

    this.showPollModal.set(true);
  }

  closePollModal(): void {
    this.showPollModal.set(false);
    this.editingPoll.set(null);
    this.pollForm.reset();
  }

  addPollOption(): void {
    this.pollOptions.push(
      this.fb.group({
        timeSlot: ['', Validators.required],
        capacity: [10, [Validators.required, Validators.min(1)]],
      })
    );
  }

  removePollOption(index: number): void {
    if (this.pollOptions.length > 1) {
      this.pollOptions.removeAt(index);
    }
  }

  savePoll(): void {
    if (this.pollForm.invalid) {
      this.pollForm.markAllAsTouched();
      return;
    }

    const formValue = this.pollForm.value;

    // Format dates for backend - date inputs return ISO strings
    const formatDateForBackend = (dateString: string): string => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    };

    // Format time for backend - time input returns HH:MM format
    const formatTimeForBackend = (timeString: string): string => {
      if (!timeString) return '';
      // Return HH:MM:SS format for MySQL TIME column
      return timeString + ':00';
    };

    // Build a snake_case payload that matches the Laravel backend expectations.
    // The frontend form / DTO uses camelCase; the API requires snake_case field names.
    const payload = {
      title: formValue.title!,
      date: formatDateForBackend(formValue.date!),
      cutoff_day: formatDateForBackend(formValue.cutOffDay!),
      cutoff_time: formatTimeForBackend(formValue.cutOffTime!),
      description: formValue.description!,
      options: (formValue.options as Array<{ timeSlot: string; capacity: number }>).map((opt) => ({
        // `text` is required by the backend (stored in the `option` lookup table).
        // Use the time slot as the option text since that is the human-readable label.
        text: opt.timeSlot,
        time_slot: opt.timeSlot,
        capacity: opt.capacity,
      })),
    };

    const editingPoll = this.editingPoll();
    if (editingPoll) {
      this.pollService.updatePoll(editingPoll.id, payload).subscribe(() => {
        this.loadPolls();
        this.closePollModal();
      });
    } else {
      this.pollService.createPoll(payload).subscribe(() => {
        this.loadPolls();
        this.closePollModal();
      });
    }
  }

  confirmDeletePoll(pollId: number): void {
    this.deletingPollId.set(pollId);
    this.showDeletePollModal.set(true);
  }

  closeDeletePollModal(): void {
    this.showDeletePollModal.set(false);
    this.deletingPollId.set(null);
  }

  deletePoll(): void {
    const pollId = this.deletingPollId();
    if (pollId !== null) {
      this.pollService.deletePoll(pollId).subscribe(() => {
        this.loadPolls();
        this.closeDeletePollModal();
      });
    }
  }

  updatePollStatus(pollId: number, status: 'active' | 'closed' | 'draft'): void {
    this.pollService.updatePollStatus(pollId, status).subscribe(() => {
      this.loadPolls();
    });
  }

  setPollFilterStatus(status: 'all' | 'active' | 'closed' | 'draft'): void {
    this.pollFilterStatus.set(status);
  }

  openCreateVolunteerModal(): void {
    this.editingVolunteer.set(null);
    this.volunteerForm.reset();
    this.showVolunteerModal.set(true);
  }

  openEditVolunteerModal(volunteer: DashboardVolunteerRow): void {
    this.editingVolunteer.set(volunteer);
    this.volunteerForm.patchValue({
      firstName: volunteer.name.split(' ')[0],
      lastName: volunteer.name.split(' ').slice(1).join(' '),
      email: volunteer.email,
      mobileNumber: volunteer.phone,
      birthdate: '',
      completeAddress: '',
      educationalAttainment: '',
      facebookName: '',
    });
    this.showVolunteerModal.set(true);
  }

  closeVolunteerModal(): void {
    this.showVolunteerModal.set(false);
    this.editingVolunteer.set(null);
    this.volunteerForm.reset();
  }

  saveVolunteer(): void {
    if (this.volunteerForm.invalid) {
      this.volunteerForm.markAllAsTouched();
      return;
    }

    const formValue = this.volunteerForm.value;
    console.log('Save volunteer:', formValue);
    this.closeVolunteerModal();
    this.loadDashboardData();
  }

  confirmDeleteVolunteer(volunteerId: number): void {
    this.deletingVolunteerId.set(volunteerId);
    this.showDeleteVolunteerModal.set(true);
  }

  closeDeleteVolunteerModal(): void {
    this.showDeleteVolunteerModal.set(false);
    this.deletingVolunteerId.set(null);
  }

  deleteVolunteer(): void {
    const volunteerId = this.deletingVolunteerId();
    if (volunteerId !== null) {
      console.log('Delete volunteer:', volunteerId);
      this.closeDeleteVolunteerModal();
      this.loadDashboardData();
    }
  }

  getVotePercentage(poll: Poll, option: PollOption): number {
    return poll.totalVotes > 0 ? (option.votes / poll.totalVotes) * 100 : 0;
  }

  getRemainingSlots(option: PollOption): number {
    return option.capacity - option.votes;
  }

  isFull(option: PollOption): boolean {
    return option.votes >= option.capacity;
  }
}
