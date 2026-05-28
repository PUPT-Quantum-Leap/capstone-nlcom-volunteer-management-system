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
import { AdminDashboardService } from '../../services/admin-dashboard.service';
import { RsvpService } from '../../services/rsvp.service';
import { UserService } from '../../services/user.service';
import { Rsvp } from '../../models/rsvp';
import { User } from '../../models/user';

@Component({
  selector: 'app-sms-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './sms-management.html',
  styleUrl: './sms-management.scss',
})
export class SmsManagementComponent {
  private readonly adminDashboardService = inject(AdminDashboardService);
  private readonly rsvpService = inject(RsvpService);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  readonly smsAudience = signal<'all' | 'voted' | 'not_voted'>('all');
  readonly smsMessage = signal('');
  readonly smsSending = signal(false);
  readonly selectedSmsTemplate = signal('');
  readonly activeVolunteers = signal(0);
  readonly latestRsvp = signal<Rsvp | null>(null);
  readonly users = signal<User[]>([]);
  readonly feedbackMessage = signal('');
  readonly feedbackType = signal<'success' | 'error' | 'info'>('info');

  readonly smsTemplates: ReadonlyArray<{ name: string; message: string }> = [
    {
      name: 'Attendance Reminder',
      message:
        'Hello team! Friendly reminder to confirm attendance for your next assigned mission.',
    },
    {
      name: 'Urgent Deployment',
      message:
        'Urgent volunteer callout: please check your ServeTrack dashboard for immediate deployment details.',
    },
    {
      name: 'Thank You Note',
      message:
        'Thank you for serving with us. Your time and effort made a real impact in our latest outreach.',
    },
  ];

  readonly smsCharacterCount = computed(() => this.smsMessage().trim().length);

  readonly smsRecipientsCount = computed(() => {
    const audience = this.smsAudience();
    const total = this.activeVolunteers();
    const voted = this.latestRsvp()?.totalResponses ?? 0;

    if (audience === 'voted') {
      return voted;
    }

    if (audience === 'not_voted') {
      return Math.max(0, total - voted);
    }

    return total;
  });

  readonly smsConfigured = signal<boolean | null>(null);
  readonly smsConfigMessage = signal('');

  constructor() {
    this.loadSmsData();
  }

  setSmsAudience(value: 'all' | 'voted' | 'not_voted'): void {
    this.smsAudience.set(value);
  }

  updateSmsMessage(value: string): void {
    this.smsMessage.set(value);
  }

  applySmsTemplate(templateMessage: string): void {
    this.selectedSmsTemplate.set(templateMessage);
    this.smsMessage.set(templateMessage);
  }

  sendSmsBroadcast(): void {
    const message = this.smsMessage().trim();

    if (!message) {
      this.showFeedback('Enter a message before sending.', 'error');
      return;
    }

    if (this.smsRecipientsCount() <= 0) {
      this.showFeedback('No recipients available for the selected audience.', 'error');
      return;
    }

    this.smsSending.set(true);

    window.setTimeout(() => {
      this.smsSending.set(false);
      this.showFeedback(
        `Email broadcast queued for ${this.smsRecipientsCount()} recipients.`,
        'success',
      );
      this.smsMessage.set('');
      this.selectedSmsTemplate.set('');
    }, 900);
  }

  private loadSmsData(): void {
    // Check SMS configuration status
    this.adminDashboardService
      .getSmsConfigStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.smsConfigured.set(status.configured);
          this.smsConfigMessage.set(status.message ?? '');
        },
        error: () => {
          this.smsConfigured.set(false);
          this.smsConfigMessage.set('Unable to verify Email configuration');
        },
      });

    this.adminDashboardService
      .getDashboardData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.activeVolunteers.set(response.success ? response.data.stats.activeVolunteers : 0);
        },
        error: () => {
          this.activeVolunteers.set(0);
        }
      });

    this.userService
      .getUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.users.set(response.data ?? []);
        },
        error: (error: Error) => {
          console.error('Error loading users for SMS:', error);
          this.users.set([]);
        },
      });

    this.rsvpService
      .getRsvps()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const rsvps = response.data ?? [];
          const latest = rsvps
            .filter((r) => r.status === 'active' || r.status === 'closed')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;
          this.latestRsvp.set(latest);
        },
        error: () => {
          this.latestRsvp.set(null);
        },
      });
  }

  private showFeedback(message: string, type: 'success' | 'error' | 'info'): void {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
  }
}
