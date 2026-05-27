import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  AdminDashboardService,
  DashboardVolunteerRow,
} from '../../services/admin-dashboard.service';
import { NotificationItem } from '../../models/notification-item';
import { PerformanceMetric } from '../../models/performance-metric';
import { Rsvp } from '../../models/rsvp';
import { RsvpService } from '../../services/rsvp.service';

interface DashboardEventRow {
  id: number;
  title: string;
  dateLabel: string;
  timestamp: number;
  totalResponses: number;
  status: Rsvp['status'];
  shifts: number;
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  private readonly adminDashboardService = inject(AdminDashboardService);
  private readonly rsvpService = inject(RsvpService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly isLoading = signal(true);
  readonly isRsvpLoading = signal(true);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly volunteers = signal<DashboardVolunteerRow[]>([]);
  readonly performanceMetrics = signal<PerformanceMetric[]>([]);
  readonly rsvps = signal<Rsvp[]>([]);
  readonly totalVolunteers = signal(0);
  readonly activeVolunteers = signal(0);
  readonly upcomingEvents = signal(0);
  readonly completedMissions = signal(0);
  readonly currentTime = signal(new Date());

  readonly currentDateLabel = computed(() =>
    new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(this.currentTime()),
  );

  readonly currentTimeLabel = computed(() =>
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(this.currentTime()),
  );

  readonly unreadNotificationCount = computed(
    () => this.notifications().filter((item) => !item.read).length,
  );

  readonly inactiveVolunteers = computed(() =>
    Math.max(0, this.totalVolunteers() - this.activeVolunteers()),
  );

  readonly engagementRate = computed(() => {
    const total = this.totalVolunteers();
    if (total === 0) {
      return 0;
    }

    return Math.round((this.activeVolunteers() / total) * 100);
  });

  readonly completionRate = computed(() => {
    const denominator = this.completedMissions() + this.upcomingEvents();
    if (denominator === 0) {
      return 0;
    }

    return Math.round((this.completedMissions() / denominator) * 100);
  });

  readonly nextEvents = computed<DashboardEventRow[]>(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return this.rsvps()
      .map((rsvp) => {
        const parsedDate = this.safeDate(rsvp.date);
        let dateYmd = '';
        if (parsedDate) {
          dateYmd = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
        }

        return {
          id: rsvp.id,
          title: rsvp.title,
          dateLabel: rsvp.date,
          dateYmd: dateYmd,
          timestamp: parsedDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
          totalResponses: rsvp.totalResponses,
          status: rsvp.status,
          shifts: rsvp.shifts.length,
        };
      })
      .filter((event) => event.status === 'active' && event.dateYmd >= todayStr)
      .sort((left, right) => left.timestamp - right.timestamp)
      .slice(0, 3);
  });

  readonly upcomingEventRows = computed(() =>
    this.nextEvents().map((event) => ({
      id: event.id,
      title: event.title,
      dateLabel: event.dateLabel,
      responses: event.totalResponses,
      status: event.status,
    })),
  );

  readonly topVolunteers = computed(() =>
    [...this.volunteers()]
      .sort((left, right) => {
        if (left.status === right.status) {
          return left.name.localeCompare(right.name);
        }

        return left.status === 'active' ? -1 : 1;
      })
      .slice(0, 5)
      .map(volunteer => ({
        ...volunteer,
        department: (volunteer as any).department || 'General',
      })),
  );

  readonly leaderboard = computed(() =>
    [...this.performanceMetrics()]
      .sort((left, right) => {
        if (right.rating !== left.rating) {
          return right.rating - left.rating;
        }

        return right.tasksCompleted - left.tasksCompleted;
      })
      .slice(0, 4),
  );

  private timeIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.loadDashboardData();
    this.loadRsvps();
    this.startClock();
  }

  navigateTo(path: string): void {
    void this.router.navigateByUrl(path);
  }

  formatStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  private loadDashboardData(): void {
    this.adminDashboardService
      .getDashboardData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response.success && response.data) {
          this.totalVolunteers.set(response.data.stats.totalVolunteers);
          this.activeVolunteers.set(response.data.stats.activeVolunteers);
          this.upcomingEvents.set(response.data.stats.upcomingEvents);
          this.completedMissions.set(response.data.stats.completedMissions);
          this.notifications.set(response.data.notifications ?? []);
          this.volunteers.set(response.data.volunteers ?? []);
          this.performanceMetrics.set(response.data.performanceMetrics ?? []);
        } else {
          this.notifications.set([]);
          this.volunteers.set([]);
          this.performanceMetrics.set([]);
          this.totalVolunteers.set(0);
          this.activeVolunteers.set(0);
          this.upcomingEvents.set(0);
          this.completedMissions.set(0);
        }

        this.isLoading.set(false);
      });
  }

  private loadRsvps(): void {
    this.rsvpService
      .getRsvps()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rsvps.set(response.data ?? []);
          this.isRsvpLoading.set(false);
        },
        error: (error: Error) => {
          console.error('Error loading RSVPs:', error);
          this.rsvps.set([]);
          this.isRsvpLoading.set(false);
        },
      });
  }

  private startClock(): void {
    this.currentTime.set(new Date());
    this.timeIntervalId = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    this.destroyRef.onDestroy(() => {
      if (this.timeIntervalId) {
        clearInterval(this.timeIntervalId);
      }
    });
  }

  private safeDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
