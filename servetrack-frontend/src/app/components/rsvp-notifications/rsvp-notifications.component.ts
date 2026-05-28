import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { RsvpService } from '../../services/rsvp.service';
import { RsvpNotification } from '../../models/rsvp';

@Component({
  selector: 'app-rsvp-notifications',
  standalone: true,
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rsvp-notifications.component.html',
  styleUrl: './rsvp-notifications.component.scss',
})
export class RsvpNotificationsComponent implements OnInit {
  private rsvpService = inject(RsvpService);
  private destroyRef = inject(DestroyRef);

  notifications = signal<RsvpNotification[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  showPanel = signal(false);

  unreadCount = computed(() => this.notifications().filter((n) => !n.isRead).length);
  hasNotifications = computed(() => this.notifications().length > 0);

  ngOnInit(): void {
    this.loadNotifications();
  }

  /**
   * Load RSVP notifications for the authenticated user.
   */
  private loadNotifications(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.rsvpService
      .getNotifications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.notifications.set(response.data);
          this.isLoading.set(false);
        },
        error: () => {
          this.error.set('Failed to load notifications.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Toggle the notification panel visibility.
   */
  togglePanel(): void {
    this.showPanel.update((value) => !value);
  }

  /**
   * Close the notification panel.
   */
  closePanel(): void {
    this.showPanel.set(false);
  }

  /**
   * Mark a single notification as read.
   */
  markAsRead(notification: RsvpNotification): void {
    if (notification.isRead) {
      return;
    }

    this.rsvpService
      .markNotificationAsRead(notification.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Update the notification in the list
          const updated: RsvpNotification = {
            ...notification,
            isRead: true,
            readAt: new Date().toISOString(),
          };

          this.notifications.update((notifs) =>
            notifs.map((n) => (n.id === notification.id ? updated : n))
          );
        },
      });
  }

  /**
   * Mark all notifications as read.
   */
  markAllAsRead(): void {
    this.rsvpService
      .markAllNotificationsAsRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Mark all as read in the UI
          this.notifications.update((notifs) =>
            notifs.map((n) => ({
              ...n,
              isRead: true,
              readAt: new Date().toISOString(),
            }))
          );
        },
      });
  }

  /**
   * Dismiss (remove) a single notification from the view.
   */
  dismissOne(id: number): void {
    this.notifications.update((notifs) => notifs.filter((n) => n.id !== id));
  }

  /**
   * Clear all notifications from the view and close the panel.
   */
  clearAll(): void {
    // Mark all as read on the backend first, then clear the local list
    this.rsvpService
      .markAllNotificationsAsRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
    this.notifications.set([]);
    this.showPanel.set(false);
  }

  /**
   * Get the notification type label for display.
   */
  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      event_created: 'Event Created',
      event_updated: 'Event Updated',
      reminder: 'Reminder',
    };
    return labels[type] || type;
  }

  /**
   * Get the CSS class for notification type badge.
   */
  getTypeBadgeClass(type: string): string {
    const classes: Record<string, string> = {
      event_created: 'badge-created',
      event_updated: 'badge-updated',
      reminder: 'badge-reminder',
    };
    return classes[type] || 'badge-default';
  }
}
