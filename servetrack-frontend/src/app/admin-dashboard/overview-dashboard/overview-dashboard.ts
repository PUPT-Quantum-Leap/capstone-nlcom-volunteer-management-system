import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminDashboardService, DashboardVolunteerRow } from '../../services/admin-dashboard.service';
import { NotificationItem } from '../../models/notification-item';
import { PerformanceMetric } from '../../models/performance-metric';
import { Rsvp } from '../../models/rsvp';
import { RsvpService } from '../../services/rsvp.service';

interface EventRow {
  id: number;
  title: string;
  dateLabel: string;
  dateValue: number;
  status: string;
  responses: number;
}

@Component({
  selector: 'app-overview-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './overview-dashboard.html',
  styleUrl: './overview-dashboard.scss',
})
export class OverviewDashboard implements OnInit {
  private adminDashboardService = inject(AdminDashboardService);
  private rsvpService = inject(RsvpService);
  private destroyRef = inject(DestroyRef);

  // Outputs to communicate with parent
  setView = output<string>();

  // Signals
  isLoading = signal(false);
  totalVolunteers = signal(0);
  activeVolunteers = signal(0);
  upcomingEvents = signal(0);
  completedMissions = signal(0);
  notifications = signal<NotificationItem[]>([]);
  volunteerRows = signal<DashboardVolunteerRow[]>([]);
  performanceMetrics = signal<PerformanceMetric[]>([]);
  rsvps = signal<Rsvp[]>([]);

  // Clock signals
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

  notificationCount = computed(
    () => this.notifications().filter((notification) => !notification.read).length,
  );

  upcomingEventRows = computed<EventRow[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.rsvps()
      .map((rsvp) => {
        const parsedDate = this.safeDate(rsvp.date);
        return {
          id: rsvp.id,
          title: rsvp.title,
          dateLabel: rsvp.date,
          dateValue: parsedDate ? parsedDate.getTime() : Number.MAX_SAFE_INTEGER,
          status: rsvp.status,
          responses: rsvp.totalResponses,
        };
      })
      .filter((event) => event.dateValue >= today.getTime())
      .sort((a, b) => a.dateValue - b.dateValue)
      .slice(0, 5);
  });

  private timeUpdateInterval: any;

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadRsvps();

    // Initialize clock
    this.currentTime.set(new Date());
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

  private loadRsvps(): void {
    this.rsvpService.getRsvps().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: { data: Rsvp[] }) => {
        this.rsvps.set(response.data);
      },
      error: (error: Error) => {
        console.error('Error loading RSVPs:', error);
      },
    });
  }

  private safeDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  // Navigation methods
  goToVolunteers(): void {
    this.setView.emit('volunteers');
  }

  goToPerformance(): void {
    this.setView.emit('performance');
  }

  goToRsvps(): void {
    this.setView.emit('rsvps');
  }
}
