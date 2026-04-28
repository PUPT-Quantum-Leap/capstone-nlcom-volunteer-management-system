import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { VolunteerService } from '../../services/volunteer.service';
import { AuthService } from '../../services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Attendance, AttendanceStats, AttendancePeriod } from '../../models/attendance';

interface PollOption {
  id: number;
  timeSlot: string;
  capacity: number;
  votes: number;
}

interface Poll {
  id: number;
  title: string;
  description?: string;
  date?: string;
  cutOffDay?: string;
  status: 'draft' | 'active' | 'closed';
  options: PollOption[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class OverviewComponent implements OnInit {
  private router = inject(Router);
  private volunteerService = inject(VolunteerService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

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

  // ── Attendance Stats ───────────────────────────────────────────────────
  attendanceTotalHours = signal(0);
  attendanceGoalHours = signal(40);

  attendanceRate = computed(() => {
    const goal = this.attendanceGoalHours();
    if (goal === 0) return 0;
    return Math.min(100, Math.round((this.attendanceTotalHours() / goal) * 100));
  });

  locationAssigned = signal('—');
  taskAssigned = signal('—');

  // ── Poll Status ──────────────────────────────────────────────────────────
  activePoll = signal<Poll | null>(null);
  hasSubmittedVote = signal(false);

  ngOnInit(): void {
    this.startRealTimeClock();
    this.loadAttendanceStats();
    this.loadProfile();
    this.loadSamplePoll();
  }

  private startRealTimeClock(): void {
    this.currentTime.set(new Date());
    this.timeUpdateInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    this.destroyRef.onDestroy(() => {
      if (this.timeUpdateInterval) {
        clearInterval(this.timeUpdateInterval);
      }
    });
  }

  private loadAttendanceStats(): void {
    this.volunteerService.getAttendanceStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
      if (response.success && response.data) {
        const stats = response.data;
        this.attendanceTotalHours.set(stats.monthly.hours);
      }
    });
  }

  private loadProfile(): void {
    this.volunteerService.getProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
      if (response.success && response.data) {
        const data = response.data;
        if (data.positions?.length) {
          this.taskAssigned.set(data.positions.map((p) => p.name).join(', '));
        }
      }
    });
  }

  private loadSamplePoll(): void {
    this.activePoll.set({
      id: 1,
      title: 'March 2026 Outreach Assignment Preferences',
      description: 'Select your preferred time slot for the upcoming community outreach event.',
      date: '2026-03-15',
      cutOffDay: '2026-03-10',
      status: 'active',
      options: [
        { id: 1, timeSlot: 'Morning Shift (6:00 AM - 12:00 PM)', votes: 12, capacity: 20 },
        { id: 2, timeSlot: 'Afternoon Shift (12:00 PM - 6:00 PM)', votes: 8, capacity: 15 },
        { id: 3, timeSlot: 'Evening Shift (6:00 PM - 10:00 PM)', votes: 5, capacity: 10 },
      ],
    });
  }

  navigateTo(route: string): void {
    this.router.navigate(['/volunteer-dashboard', route]);
  }
}
