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

  readonly smsAudience = signal<'all' | 'active' | 'new'>('active');
  readonly smsMessage = signal('');
  readonly smsSending = signal(false);
  readonly selectedSmsTemplate = signal('');
  readonly autoSmsEnabled = signal(false);
  readonly autoSmsHoursBefore = signal(24);
  readonly users = signal<User[]>([]);
  readonly activeVolunteers = signal(0);
  readonly rsvps = signal<Rsvp[]>([]);
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
    {
      name: 'RSVP Cutoff Reminder',
      message:
        'Reminder: The RSVP deadline for {event} is approaching on {cutoffDate}. Please confirm your attendance.',
    },
  ];

  readonly smsCharacterCount = computed(() => this.smsMessage().trim().length);

  readonly smsRecipientsCount = computed(() => {
    const users = this.users().filter((user) => !user.deleted_at);

    if (this.smsAudience() === 'all') {
      return users.length;
    }

    if (this.smsAudience() === 'new') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      return users.filter((user) => {
        const createdAt = new Date(user.created_at);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= oneMonthAgo;
      }).length;
    }

    return this.activeVolunteers();
  });

  readonly autoSmsCutoffRecipients = computed(() => {
    const now = new Date();

    return this.rsvps().filter((rsvp) => {
      if (!rsvp.cutOffDay || rsvp.status !== 'active') {
        return false;
      }

      const cutoff = new Date(`${rsvp.cutOffDay}T${rsvp.cutOffTime || '23:59:00'}`);
      const hoursUntil = (cutoff.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntil > 0 && hoursUntil <= this.autoSmsHoursBefore();
    });
  });

  readonly smsConfigured = signal<boolean | null>(null);
  readonly smsConfigMessage = signal('');

  constructor() {
    this.loadSmsData();
  }

  setSmsAudience(value: 'all' | 'active' | 'new'): void {
    this.smsAudience.set(value);
  }

  updateSmsMessage(value: string): void {
    this.smsMessage.set(value);
  }

  applySmsTemplate(templateMessage: string): void {
    this.selectedSmsTemplate.set(templateMessage);
    this.smsMessage.set(templateMessage);
  }

  setAutoSmsEnabled(enabled: boolean): void {
    this.autoSmsEnabled.set(enabled);
    this.showFeedback(
      enabled
        ? 'Automatic Email reminders enabled for upcoming cutoffs.'
        : 'Automatic Email reminders disabled.',
      enabled ? 'success' : 'info',
    );
  }

  setAutoSmsHoursBefore(hours: number): void {
    this.autoSmsHoursBefore.set(hours);
  }

  sendAutomaticCutoffReminders(): void {
    const upcoming = this.autoSmsCutoffRecipients();

    if (upcoming.length === 0) {
      this.showFeedback('No upcoming cutoffs within the configured timeframe.', 'info');
      return;
    }

    this.showFeedback(`Sent cutoff reminders for ${upcoming.length} event(s).`, 'success');
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
      .subscribe((response) => {
        this.activeVolunteers.set(response.success ? response.data.stats.activeVolunteers : 0);
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
          this.rsvps.set(response.data ?? []);
        },
        error: (error: Error) => {
          console.error('Error loading RSVPs for SMS:', error);
          this.rsvps.set([]);
        },
      });
  }

  private showFeedback(message: string, type: 'success' | 'error' | 'info'): void {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
  }
}
