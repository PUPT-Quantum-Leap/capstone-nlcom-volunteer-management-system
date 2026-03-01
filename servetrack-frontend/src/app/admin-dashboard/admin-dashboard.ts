import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { DatePipe } from '@angular/common';
import { NotificationItem } from '../models/notification-item';
import { PerformanceMetric } from '../models/performance-metric';

@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  readonly defaultPhoto = '/assets/nlcom.png';

  currentView = signal<
    'overview' | 'volunteers' | 'attendance' | 'performance' | 'polls' | 'ics' | 'users'
  >('overview');
  userName = signal(this.authService.currentUser()?.name || 'Admin');
  sidebarCollapsed = signal(false);
  isLoading = signal(false);

  showNotifications = signal(false);
  showLogoutModal = signal(false);
  searchQuery = signal('');

  notifications = signal<NotificationItem[]>([
    {
      id: 1,
      title: 'New Volunteer Registration',
      description: '3 new volunteers registered today.',
      time: '1h ago',
      read: false,
    },
    {
      id: 2,
      title: 'Schedule Update Required',
      description: 'Please review and approve pending schedules.',
      time: '3h ago',
      read: false,
    },
  ]);

  notificationCount = computed(
    () => this.notifications().filter((notification) => !notification.read).length,
  );

  totalVolunteers = signal(42);
  activeVolunteers = signal(35);
  upcomingEvents = signal(8);
  completedMissions = signal(127);

  performanceMetrics = signal<PerformanceMetric[]>([
    {
      id: 1,
      volunteerId: 1,
      volunteerName: 'Jasmine Deleon',
      attendanceRate: 92,
      hoursServed: 48,
      tasksCompleted: 15,
      rating: 4.8,
      lastActivity: '2025-08-15',
    },
    {
      id: 2,
      volunteerId: 2,
      volunteerName: 'Marco Santos',
      attendanceRate: 88,
      hoursServed: 42,
      tasksCompleted: 12,
      rating: 4.5,
      lastActivity: '2025-08-14',
    },
    {
      id: 3,
      volunteerId: 3,
      volunteerName: 'Elena Cruz',
      attendanceRate: 95,
      hoursServed: 56,
      tasksCompleted: 18,
      rating: 4.9,
      lastActivity: '2025-08-15',
    },
    {
      id: 4,
      volunteerId: 4,
      volunteerName: 'Rafael Torres',
      attendanceRate: 85,
      hoursServed: 38,
      tasksCompleted: 10,
      rating: 4.3,
      lastActivity: '2025-08-13',
    },
    {
      id: 5,
      volunteerId: 5,
      volunteerName: 'Sofia Reyes',
      attendanceRate: 90,
      hoursServed: 45,
      tasksCompleted: 14,
      rating: 4.7,
      lastActivity: '2025-08-15',
    },
  ]);

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

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  setView(
    view: 'overview' | 'volunteers' | 'attendance' | 'performance' | 'polls' | 'ics' | 'users',
  ): void {
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
