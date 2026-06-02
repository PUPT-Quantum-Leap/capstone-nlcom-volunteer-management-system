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
import { AnalyticsService, ReportData } from '../../services/analytics.service';
import { CustomSelect, SelectOption } from '../../components/custom-select/custom-select';
import { NotificationItem } from '../../models/notification-item';
import { PerformanceMetric } from '../../models/performance-metric';
import { Rsvp } from '../../models/rsvp';
import { RsvpService } from '../../services/rsvp.service';

import { GlobalSearchService } from '../../services/global-search.service';

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
  imports: [CommonModule, CustomSelect],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  private readonly adminDashboardService = inject(AdminDashboardService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly rsvpService = inject(RsvpService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly globalSearchService = inject(GlobalSearchService);

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

  readonly reportData = signal<ReportData | null>(null);
  readonly dateRangeFilter = signal<'all' | 'month' | 'quarter' | 'year'>('all');

  readonly dateRangeOptions: SelectOption<'all' | 'month' | 'quarter' | 'year'>[] = [
    { label: 'All Time', value: 'all' },
    { label: 'This Month', value: 'month' },
    { label: 'This Quarter', value: 'quarter' },
    { label: 'This Year', value: 'year' },
  ];

  readonly paginatedSkills = computed(() => {
    const data = this.reportData()?.skillsDistribution.skills ?? [];
    return data.filter(skill => skill.count > 0);
  });

  readonly maxSkillCount = computed(() => {
    const skills = this.reportData()?.skillsDistribution.skills ?? [];
    return Math.max(...skills.map(s => s.count), 1);
  });

  // --- Pie Chart (Department Breakdown) ---
  private readonly pieColors = [
    '#3b82f6', '#22c55e', '#f97316', '#9333ea',
    '#ef4444', '#14b8a6', '#eab308', '#ec4899',
    '#6366f1', '#84cc16', '#06b6d4', '#d946ef',
  ];

  readonly totalDepartmentCount = computed(() => {
    return this.reportData()?.departmentBreakdown.reduce((sum, d) => sum + d.count, 0) ?? 0;
  });

  readonly departmentChartSlices = computed(() => {
    const data = this.reportData()?.departmentBreakdown ?? [];
    const total = this.totalDepartmentCount();
    if (total === 0) return [];

    const sorted = [...data].sort((a, b) => b.count - a.count);
    const cols = 3;
    const columns: (typeof sorted)[] = [[], [], []];
    let remaining = [...sorted];
    for (let c = 0; c < cols; c++) {
      const size = Math.ceil(remaining.length / (cols - c));
      columns[c] = remaining.slice(0, size);
      remaining = remaining.slice(size);
    }
    const maxRows = Math.max(...columns.map(c => c.length));
    const rowOrdered: typeof sorted = [];
    for (let r = 0; r < maxRows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r < columns[c].length) rowOrdered.push(columns[c][r]);
      }
    }

    const cx = 100, cy = 100, r = 85;
    let currentAngle = -Math.PI / 2;

    return rowOrdered.map((dept, i) => {
      const sliceAngle = (dept.count / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      currentAngle = endAngle;

      return {
        path,
        color: this.pieColors[i % this.pieColors.length],
        name: dept.name,
        count: dept.count,
        percentage: dept.percentage,
      };
    });
  });

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

  readonly activeUpcomingCount = computed(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return this.rsvps().filter(r => r.status === 'active' && r.date >= todayStr).length;
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

  readonly allIncomingEvents = computed(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return this.rsvps()
      .filter(r => r.status === 'active' && r.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(event => {
        const parsed = this.safeDate(event.date);
        const month = parsed
          ? parsed.toLocaleString('en-US', { month: 'short' }).toUpperCase()
          : '';
        const day = parsed ? parsed.getDate() : 0;
        const year = parsed ? parsed.getFullYear() : 0;
        const dateLabel = parsed
          ? parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : event.date;
        const firstShift = event.shifts[0];
        return {
          id: event.id,
          title: event.title,
          description: event.description,
          dateLabel,
          month,
          day,
          year,
          timeSlot: firstShift?.timeSlot ?? '',
          location: event.eventLocation ?? firstShift?.text ?? '',
          responses: event.totalResponses,
          status: event.status,
        };
      });
  });

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
    this.loadAnalyticsData();
    this.startClock();
  }

  navigateTo(path: string): void {
    if (path === '/admin-dashboard/rsvps') {
      this.globalSearchService.clearSearchQuery();
    }
    void this.router.navigateByUrl(path);
  }

  viewEventDetails(title: string): void {
    void this.router.navigate(['/admin-dashboard/rsvps'], { queryParams: { search: title } });
  }

  formatStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  private loadDashboardData(): void {
    this.adminDashboardService
      .getDashboardData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
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
        },
        error: (error: Error) => {
          console.error('Error loading dashboard data:', error);
          this.notifications.set([]);
          this.volunteers.set([]);
          this.performanceMetrics.set([]);
          this.totalVolunteers.set(0);
          this.activeVolunteers.set(0);
          this.upcomingEvents.set(0);
          this.completedMissions.set(0);
          this.isLoading.set(false);
        },
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

  private loadAnalyticsData(): void {
    const dateRange = this.dateRangeFilter();
    this.analyticsService
      .getReportData(dateRange)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.reportData.set(response.data);
          }
        },
        error: () => {
          console.error('Failed to load analytics data.');
        },
      });
  }

  calculateSkillPercentage(count: number): number {
    return Math.round((count / this.maxSkillCount()) * 100);
  }

  setDateRange(range: 'all' | 'month' | 'quarter' | 'year'): void {
    this.dateRangeFilter.set(range);
    this.loadAnalyticsData();
  }

}
