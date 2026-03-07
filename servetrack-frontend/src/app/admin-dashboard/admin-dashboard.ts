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
import { Poll, CreatePollDto, PollOption } from '../models/poll';
import { PollService } from '../services/poll.service';

@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, CommonModule],
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

  readonly defaultPhoto = '/assets/nlcom.png';

  currentView = signal<'overview' | 'volunteers' | 'attendance' | 'performance' | 'polls' | 'ics' | 'users' | 'analytics' | 'events' | 'sms' | 'backup'>('overview');
  userName = signal(this.authService.currentUser()?.name || 'Admin');
  sidebarCollapsed = signal(false);
  isLoading = signal(false);

  showNotifications = signal(false);
  showLogoutModal = signal(false);
  showPollModal = signal(false);
  showDeletePollModal = signal(false);
  searchQuery = signal('');
  editingPoll = signal<Poll | null>(null);
  deletingPollId = signal<number | null>(null);
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

  pollForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    date: ['', Validators.required],
    cutOffDay: ['', Validators.required],
    cutOffTime: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
    options: this.fb.array([]),
  });

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadPolls();
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
    this.pollService.getPolls().subscribe((polls) => {
      this.polls.set(polls);
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

    this.pollForm.patchValue({
      title: poll.title,
      date: poll.date,
      cutOffDay: poll.cutOffDay,
      cutOffTime: poll.cutOffTime,
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
    const dto: CreatePollDto = {
      title: formValue.title!,
      date: formValue.date!,
      cutOffDay: formValue.cutOffDay!,
      cutOffTime: formValue.cutOffTime!,
      description: formValue.description!,
      options: (formValue.options as Array<{ timeSlot: string; capacity: number }>).map((opt) => ({
        timeSlot: opt.timeSlot,
        capacity: opt.capacity,
      })),
    };

    const editingPoll = this.editingPoll();
    if (editingPoll) {
      this.pollService.updatePoll(editingPoll.id, dto).subscribe(() => {
        this.loadPolls();
        this.closePollModal();
      });
    } else {
      this.pollService.createPoll(dto).subscribe(() => {
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
