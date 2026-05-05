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
import { RsvpService } from '../../services/rsvp.service';
import { Rsvp } from '../../models/rsvp';
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
  private rsvpService = inject(RsvpService);
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

  private timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

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
    this.volunteerService.getAttendanceStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const stats = response.data;
          this.attendanceTotalHours.set(stats.monthly.hours);
        }
      },
      error: (error) => {
        console.error('[OverviewComponent] Failed to load attendance stats:', error);
        this.attendanceTotalHours.set(0);
      }
    });
  }

  private loadProfile(): void {
    this.volunteerService.getProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data;
          if (data.positions?.length) {
            this.taskAssigned.set(data.positions.map((p) => p.name).join(', '));
          }
        }
      },
      error: (error) => {
        console.error('[OverviewComponent] Failed to load profile:', error);
        this.taskAssigned.set('—');
      }
    });
  }

  private loadSamplePoll(): void {
    this.rsvpService.getRsvps().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        const rsvps: Rsvp[] = response.data;
        const activeRsvps = rsvps.filter((r: Rsvp) => r.status === 'active');

        if (activeRsvps.length > 0) {
          const rsvp = activeRsvps[0];
          this.activePoll.set({
            id: rsvp.id,
            title: rsvp.title,
            description: rsvp.description,
            date: rsvp.date,
            cutOffDay: rsvp.cutOffDay,
            status: rsvp.status,
            options: rsvp.shifts.map((shift) => ({
              id: shift.id,
              timeSlot: shift.timeSlot,
              capacity: shift.capacity,
              votes: shift.responses,
            })),
          });

          if (rsvp.userVote) {
            this.hasSubmittedVote.set(true);
          }
        }
      },
      error: (error) => {
        console.error('[OverviewComponent] Failed to load RSVPs:', error);
      }
    });
  }


  navigateTo(route: string): void {
    this.router.navigate(['/volunteer-dashboard', route]);
  }
}
