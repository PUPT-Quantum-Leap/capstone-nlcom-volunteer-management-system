import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  DestroyRef,
} from '@angular/core';

import { VolunteerService, ApiResponse } from '../../services/volunteer.service';
import { RsvpService } from '../../services/rsvp.service';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Attendance, AttendanceStats } from '../../models/attendance';
import { Rsvp, UserVote } from '../../models/rsvp';
import { VolunteerProfileResponse } from '../../models/volunteer-profile';
import { Time12hrPipe } from '../../pipes/time12hr.pipe';

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
  userVote?: UserVote | null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Time12hrPipe],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class OverviewComponent implements OnInit {

  private volunteerService = inject(VolunteerService);
  private rsvpService = inject(RsvpService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  isLoading = signal(true);
  hasDashboardData = signal(false);

  // ── Real-time Clock ──────────────────────────────────────────────────────
  currentTime = signal(new Date());
  currentDateFormatted = computed(() => {
    const date = this.currentTime();
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
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
    this.hydrateFromCache();
    this.loadAllData();
  }

  private hydrateFromCache(): void {
    const stats = this.volunteerService.getCachedAttendanceStats();
    const profile = this.volunteerService.getCachedProfile();
    const rsvps = this.rsvpService.getCachedRsvps();
    const monthly = this.volunteerService.getCachedAttendance('monthly');

    if (!stats && !profile && !rsvps && !monthly) return;

    this.hasDashboardData.set(true);

    if (stats?.success && stats.data) {
      this.attendanceTotalHours.set(stats.data.monthly.hours);
    }
    if (profile) {
      if (profile.positions?.length) {
        this.taskAssigned.set(profile.positions.map((p) => p.name).join(', '));
      }
    }
    if (rsvps && rsvps.data.length > 0) {
      const activeAssignments = rsvps.data
        .filter(r => r.userVote != null && r.status === 'active')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (activeAssignments.length > 0) {
        this.locationAssigned.set(activeAssignments[0].eventLocation || 'Main Office');
      } else if (monthly?.success && monthly.data?.length) {
        this.locationAssigned.set(monthly.data[0].location || 'Not Assigned');
      } else {
        this.locationAssigned.set('Not Assigned');
      }
      const active = rsvps.data.find(r => r.status === 'active');
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
            votes: s.responses,
          })),
          userVote: active.userVote,
        });
        this.hasSubmittedVote.set(!!active.userVote);
      }
    } else if (monthly?.success && monthly.data?.length) {
      this.locationAssigned.set(monthly.data[0].location || 'Not Assigned');
    } else {
      this.locationAssigned.set('Not Assigned');
    }
  }

  private loadAllData(): void {
    this.isLoading.set(true);

    forkJoin({
      stats: this.volunteerService.getAttendanceStats().pipe(
        catchError(() => of({ success: false, data: null as unknown as AttendanceStats })),
      ),
      profile: this.volunteerService.getProfile().pipe(
        catchError(() => of({ success: false, data: null as unknown as VolunteerProfileResponse })),
      ),
      rsvps: this.rsvpService.getRsvps().pipe(
        catchError(() => of({ data: [] as Rsvp[] })),
      ),
      monthly: this.volunteerService.getAttendance('monthly').pipe(
        catchError(() => of({ success: false, data: [] as Attendance[] })),
      ),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (results) => {
        // Attendance stats
        if (results.stats.success && results.stats.data) {
          this.attendanceTotalHours.set(results.stats.data.monthly.hours);
        }

        // Profile
        if (results.profile.success && results.profile.data) {
          const data = results.profile.data;
          if (data.positions?.length) {
            this.taskAssigned.set(data.positions.map((p) => p.name).join(', '));
          }
        }

        // RSVPs — used for both assignment location and poll
        const rsvpData = results.rsvps.data;
        if (rsvpData.length > 0) {
          const activeAssignments = rsvpData
            .filter(r => r.userVote != null && r.status === 'active')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          if (activeAssignments.length > 0) {
            this.locationAssigned.set(activeAssignments[0].eventLocation || 'Main Office');
          } else {
            this.setLocationFromMonthly(results.monthly);
          }

          const active = rsvpData.find(r => r.status === 'active');
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
                votes: s.responses,
              })),
              userVote: active.userVote,
            });
            this.hasSubmittedVote.set(!!active.userVote);
          }
        } else {
          this.setLocationFromMonthly(results.monthly);
        }

        this.isLoading.set(false);
        this.hasDashboardData.set(true);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  private setLocationFromMonthly(response: ApiResponse<Attendance[]>): void {
    if (response.success && response.data && response.data.length > 0) {
      this.locationAssigned.set(response.data[0].location || 'Not Assigned');
    } else {
      this.locationAssigned.set('Not Assigned');
    }
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

  isUserVotedOption(option: PollOption, poll: Poll): boolean {
    return poll.userVote?.timeSlotId === option.id;
  }

  navigateToPolls(): void {
    this.router.navigate(['/volunteer-dashboard/polls']);
  }
}
