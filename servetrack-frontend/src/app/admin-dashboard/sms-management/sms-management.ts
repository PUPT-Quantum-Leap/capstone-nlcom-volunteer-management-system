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

  readonly rsvps = signal<Rsvp[]>([]);
  readonly selectedRsvpId = signal<number | null>(null);
  readonly recipients = signal<any[]>([]);
  readonly loadingRecipients = signal(false);

  readonly sendingModalStatus = signal<'sending' | 'success' | 'error' | null>(null);
  readonly sendingModalError = signal('');

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
      name: 'Event Rescheduling',
      message:
        'Hello team! Please be informed that the event [Event Title] has been rescheduled. We apologize for any inconvenience caused. Please review the updated details on the dashboard.',
    },
    {
      name: 'Event Cancellation',
      message:
        'Hello team! We regret to inform you that the event [Event Title] has been cancelled. Thank you for your understanding, and we hope to see you at our next event.',
    },
  ];

  readonly smsCharacterCount = computed(() => this.smsMessage().trim().length);

  readonly smsRecipientsCount = computed(() => this.recipients().length);

  readonly smsConfigured = signal<boolean | null>(null);
  readonly smsConfigMessage = signal('');

  constructor() {
    this.loadSmsData();
  }

  setSmsAudience(value: 'all' | 'voted' | 'not_voted'): void {
    this.smsAudience.set(value);
    this.loadRecipientsPreview();
  }

  selectRsvp(id: number | null): void {
    this.selectedRsvpId.set(id);
    if (!id && this.smsAudience() !== 'all') {
      this.smsAudience.set('all');
    }
    this.loadRecipientsPreview();
  }

  updateSmsMessage(value: string): void {
    this.smsMessage.set(value);
  }

  applySmsTemplate(templateMessage: string): void {
    this.selectedSmsTemplate.set(templateMessage);
    let formatted = templateMessage;
    const rsvp = this.rsvps().find(r => r.id === this.selectedRsvpId());
    if (rsvp) {
      formatted = formatted.replace(/\[Event Title\]/g, rsvp.title);
    }
    this.smsMessage.set(formatted);
  }

  closeSendingModal(): void {
    this.sendingModalStatus.set(null);
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

    this.sendingModalStatus.set('sending');
    this.sendingModalError.set('');

    this.adminDashboardService.sendEmailBroadcast(
      this.selectedRsvpId(),
      this.smsAudience(),
      message
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.sendingModalStatus.set('success');
          this.smsMessage.set('');
          this.selectedSmsTemplate.set('');
        } else {
          this.sendingModalStatus.set('error');
          this.sendingModalError.set(res.message || 'Failed to queue email broadcast.');
        }
      },
      error: () => {
        this.sendingModalStatus.set('error');
        this.sendingModalError.set('An error occurred while sending the email broadcast.');
      }
    });
  }

  loadRecipientsPreview(): void {
    const audience = this.smsAudience();
    const rsvpId = this.selectedRsvpId();

    if (audience !== 'all' && !rsvpId) {
      this.recipients.set([]);
      return;
    }

    this.loadingRecipients.set(true);

    if (audience === 'voted' && rsvpId) {
      this.adminDashboardService.fetchAttendanceFromRsvp(rsvpId).subscribe({
        next: (res) => {
          this.loadingRecipients.set(false);
          if (res.success) {
            this.recipients.set(res.data.map(item => ({
              name: item.volunteer_name,
              email: item.volunteer_email,
              phone: item.phone || '',
              department: item.volunteer_department
            })));
          } else {
            this.recipients.set([]);
          }
        },
        error: () => {
          this.loadingRecipients.set(false);
          this.recipients.set([]);
        }
      });
    } else if (audience === 'not_voted' && rsvpId) {
      this.adminDashboardService.getRsvpNonResponders(rsvpId, { perPage: 1000 }).subscribe({
        next: (res) => {
          this.loadingRecipients.set(false);
          if (res.success) {
            this.recipients.set(res.data.map(item => ({
              name: item.volunteer_name,
              email: item.volunteer_email,
              phone: item.mobile_number || '',
              department: item.volunteer_department
            })));
          } else {
            this.recipients.set([]);
          }
        },
        error: () => {
          this.loadingRecipients.set(false);
          this.recipients.set([]);
        }
      });
    } else {
      this.adminDashboardService.getVolunteers().subscribe({
        next: (res) => {
          this.loadingRecipients.set(false);
          if (res.success) {
            this.recipients.set(res.data.map(v => ({
              name: `${v.first_name} ${v.last_name}`,
              email: v.email,
              phone: v.mobile_number || '',
              department: v.positions?.[0] ?? 'Unassigned'
            })));
          } else {
            this.recipients.set([]);
          }
        },
        error: () => {
          this.loadingRecipients.set(false);
          this.recipients.set([]);
        }
      });
    }
  }

  private loadSmsData(): void {
    // Check Email configuration status
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
      .getRsvps(100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const rsvps = response.data ?? [];
          this.rsvps.set(rsvps);
          const latest = rsvps
            .filter((r) => r.status === 'active' || r.status === 'closed')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;
          this.latestRsvp.set(latest);
          if (latest) {
            this.selectedRsvpId.set(latest.id);
          }
          this.loadRecipientsPreview();
        },
        error: () => {
          this.latestRsvp.set(null);
          this.loadRecipientsPreview();
        },
      });
  }

  private showFeedback(message: string, type: 'success' | 'error' | 'info'): void {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
  }
}
