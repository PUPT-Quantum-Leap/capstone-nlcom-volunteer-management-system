import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  DestroyRef,
} from '@angular/core';

import { VolunteerService } from '../../services/volunteer.service';
import { AuthService } from '../../services/auth.service';
import { RsvpService } from '../../services/rsvp.service';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Attendance, AttendanceStats } from '../../models/attendance';
import { Rsvp } from '../../models/rsvp';

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

  private volunteerService = inject(VolunteerService);
  private rsvpService = inject(RsvpService);
  private authService = inject(AuthService);
  private router = inject(Router);
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
    this.loadCurrentAssignment();
    this.loadProfile();
    this.loadSamplePoll();
  }

  private loadCurrentAssignment(): void {
    this.rsvpService.getRsvps().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0) {
          // Find the active RSVP that the user has voted for
          // Sorting by date to get the closest upcoming/current one
          const activeAssignments = response.data
            .filter(r => r.userVote && r.status === 'active')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          if (activeAssignments.length > 0) {
            const current = activeAssignments[0];
            this.locationAssigned.set(current.eventLocation || 'Main Office');
          } else {
            this.loadFallbackLocation();
          }
        } else {
          this.loadFallbackLocation();
        }
      },
      error: (error) => {
        console.error('[OverviewComponent] Failed to load current assignment:', error);
        this.loadFallbackLocation();
      }
    });
  }

  private loadFallbackLocation(): void {
    // Fallback to attendance log if no active RSVP
    this.volunteerService.getAttendance('monthly').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.length > 0) {
          const latest = response.data[0];
          this.locationAssigned.set(latest.location || 'Not Assigned');
        } else {
          this.locationAssigned.set('Not Assigned');
        }
      }
    });
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
        console.error('[VolunteerService] loadProfile failed:', error);
        this.taskAssigned.set('—');
      }
    });
  }

  private loadSamplePoll(): void {
    this.rsvpService.getRsvps().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0) {
          const active = response.data.find(r => r.status === 'active');
          if (active) {
            this.activePoll.set({
              id: active.id,
              title: active.title,
              description: active.description,
              date: active.date,
              cutOffDay: active.cutOffDay,
              status: active.status,
              options: active.shifts.map(s => ({
                id: s.id,
                timeSlot: s.timeSlot,
                capacity: s.capacity,
                votes: s.responses
              }))
            });
            this.hasSubmittedVote.set(!!active.userVote);
          }
        }
      }
    });
  }

  getVotePercentage(option: PollOption, poll: Poll): number {
    const totalVotes = this.getTotalVotes(poll);
    if (totalVotes === 0) return 0;
    return Math.round((option.votes / totalVotes) * 100);
  }

  getTotalVotes(poll: Poll): number {
    return poll.options.reduce((sum, opt) => sum + opt.votes, 0);
  }

  getMostVotedOption(poll: Poll): PollOption | null {
    if (poll.options.length === 0) return null;
    return poll.options.reduce((max, opt) => (opt.votes > max.votes ? opt : max), poll.options[0]);
  }

  isMostVoted(option: PollOption, poll: Poll): boolean {
    const mostVoted = this.getMostVotedOption(poll);
    return mostVoted ? option.id === mostVoted.id : false;
  }

  navigateToPolls(): void {
    this.router.navigate(['/volunteer-dashboard/polls']);
  }
}
