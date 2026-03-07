import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { DatePipe } from '@angular/common';
import { NotificationItem } from '../models/notification-item';
import { PerformanceMetric } from '../models/performance-metric';
import { AdminDashboardService, DashboardVolunteerRow } from '../services/admin-dashboard.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private adminDashboardService = inject(AdminDashboardService);
  private destroyRef = inject(DestroyRef);

  readonly defaultPhoto = '/assets/nlcom.png';

  currentView = signal<'overview' | 'volunteers' | 'attendance' | 'performance' | 'polls' | 'ics' | 'users' | 'analytics' | 'events' | 'sms' | 'backup'>('overview');
  userName = signal(this.authService.currentUser()?.name || 'Admin');
  sidebarCollapsed = signal(false);
  isLoading = signal(false);

  showNotifications = signal(false);
  showLogoutModal = signal(false);
  showAiModal = signal(false);
  searchQuery = signal('');
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

  ngOnInit(): void {
    this.loadDashboardData();
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
}
