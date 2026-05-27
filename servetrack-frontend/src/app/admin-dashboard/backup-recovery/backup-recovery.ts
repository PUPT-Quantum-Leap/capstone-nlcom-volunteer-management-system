import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AdminDashboardService,
  BackupRecord,
} from '../../services/admin-dashboard.service';

@Component({
  selector: 'app-backup-recovery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './backup-recovery.html',
  styleUrl: './backup-recovery.scss',
})
export class BackupRecoveryComponent {
  private adminDashboardService = inject(AdminDashboardService);
  private destroyRef = inject(DestroyRef);

  // Expose Math for template
  readonly Math = Math;

  // Outputs
  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  // Signals
  backupRecords = signal<BackupRecord[]>([]);
  backupHistoryPage = signal(1);
  backupHistoryPageSize = signal(5);
  backupActionLoading = signal(false);
  scheduledBackupEnabled = signal(false);
  scheduledBackupFrequency = signal<'daily' | 'weekly' | 'monthly'>('weekly');
  scheduledBackupRunTime = signal<string>('02:00');
  scheduledBackupTimezone = signal<string>('UTC');
  scheduleSettingsSaving = signal(false);

  // Confirmation dialog signals
  showConfirmationDialog = signal(false);
  confirmationDialogTitle = signal('');
  confirmationDialogMessage = signal('');
  confirmationDialogAction = signal<() => void>(() => {});
  cleanupKeepCount = signal(10);

  // Server pagination metadata
  backupLastPage = signal(1);
  backupTotalRecords = signal(0);

  // Computed
  backupTotalPages = computed(() => this.backupLastPage());

  paginatedBackupRecords = computed(() => {
    return this.backupRecords()
      .slice()
      .sort((a, b) => {
        const bDate = this.safeDate(b.created_at)?.getTime() ?? 0;
        const aDate = this.safeDate(a.created_at)?.getTime() ?? 0;
        return bDate - aDate;
      });
  });

  latestBackup = computed(() => {
    return this.backupRecords()
      .slice()
      .sort((a, b) => {
        const bDate = this.safeDate(b.created_at)?.getTime() ?? 0;
        const aDate = this.safeDate(a.created_at)?.getTime() ?? 0;
        return bDate - aDate;
      })[0] || null;
  });

  constructor() {
    this.loadBackups();
    this.loadScheduledBackupSettings();
  }

  // Safe date parsing helper
  private safeDate(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  getBackupStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      failed: 'Failed',
    };
    return statusMap[status] || status;
  }

  // Confirmation dialog helpers
  openConfirmationDialog(title: string, message: string, action: () => void): void {
    this.confirmationDialogTitle.set(title);
    this.confirmationDialogMessage.set(message);
    this.confirmationDialogAction.set(() => {
      this.closeConfirmationDialog();
      action();
    });
    this.showConfirmationDialog.set(true);
  }

  closeConfirmationDialog(): void {
    this.showConfirmationDialog.set(false);
    this.confirmationDialogTitle.set('');
    this.confirmationDialogMessage.set('');
    this.confirmationDialogAction.set(() => {});
  }

  // Backup actions
  loadBackups(): void {
    this.adminDashboardService
      .getBackups(this.backupHistoryPage(), this.backupHistoryPageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response.success) {
          this.backupRecords.set(response.data);
          this.backupLastPage.set(response.pagination?.last_page ?? 1);
          this.backupTotalRecords.set(response.pagination?.total ?? 0);
        } else {
          this.backupRecords.set([]);
          this.backupLastPage.set(1);
          this.backupTotalRecords.set(0);
        }
      });
  }

  loadScheduledBackupSettings(): void {
    this.adminDashboardService
      .getScheduledBackupSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response.success && response.data) {
          this.scheduledBackupEnabled.set(response.data.enabled);
          this.scheduledBackupFrequency.set(response.data.frequency);
          this.scheduledBackupRunTime.set(response.data.run_time);
          this.scheduledBackupTimezone.set(response.data.timezone);
        }
      });
  }

  createBackup(): void {
    this.backupActionLoading.set(true);

    this.adminDashboardService
      .createBackup('manual')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.backupHistoryPage.set(1);
            this.loadBackups();
            this.showSnackbar.emit({ message: 'Backup created successfully.', type: 'success' });
          } else {
            this.showSnackbar.emit({
              message: response.message || 'Failed to create backup',
              type: 'error',
            });
          }
          this.backupActionLoading.set(false);
        },
        error: (error: Error) => {
          console.error('Error creating backup:', error);
          this.showSnackbar.emit({ message: 'Failed to create backup', type: 'error' });
          this.backupActionLoading.set(false);
        },
      });
  }

  refreshBackups(): void {
    this.backupActionLoading.set(true);

    this.adminDashboardService
      .getBackups(this.backupHistoryPage(), this.backupHistoryPageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success) {
            const lastPage = response.pagination?.last_page ?? 1;
            this.backupRecords.set(response.data);
            this.backupLastPage.set(lastPage);
            this.backupTotalRecords.set(response.pagination?.total ?? 0);
            if (this.backupHistoryPage() > lastPage) {
              this.backupHistoryPage.set(lastPage);
              this.loadBackups();
              return;
            }
            this.showSnackbar.emit({ message: 'Backup history refreshed.', type: 'info' });
          } else {
            this.showSnackbar.emit({ message: 'Failed to refresh backup history', type: 'error' });
          }
          this.backupActionLoading.set(false);
        },
        error: (error: Error) => {
          console.error('Error refreshing backups:', error);
          this.showSnackbar.emit({ message: 'Failed to refresh backup history', type: 'error' });
          this.backupActionLoading.set(false);
        },
      });
  }

  downloadBackup(backup: BackupRecord): void {
    this.adminDashboardService
      .downloadBackup(backup.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${backup.name}.sql`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.showSnackbar.emit({ message: `Download started for ${backup.name}.`, type: 'info' });
        },
        error: (error: Error) => {
          console.error('Error downloading backup:', error);
          this.showSnackbar.emit({ message: 'Failed to download backup', type: 'error' });
        },
      });
  }

  restoreBackup(backup: BackupRecord): void {
    this.openConfirmationDialog(
      'Restore Backup',
      `Are you sure you want to restore from backup "${backup.name}"? ` +
        'This will replace all current data and cannot be undone.',
      () => {
        this.backupActionLoading.set(true);

        this.adminDashboardService
          .restoreBackup(backup.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (response) => {
              if (response.success) {
                this.showSnackbar.emit({
                  message: `Database restored successfully from ${backup.name}. Please refresh the page.`,
                  type: 'success',
                });
              } else {
                this.showSnackbar.emit({
                  message: response.message || 'Failed to restore backup',
                  type: 'error',
                });
              }
              this.backupActionLoading.set(false);
            },
            error: (error: Error) => {
              console.error('Error restoring backup:', error);
              this.showSnackbar.emit({ message: 'Failed to restore backup', type: 'error' });
              this.backupActionLoading.set(false);
            },
          });
      }
    );
  }

  deleteBackup(backupId: number): void {
    this.openConfirmationDialog(
      'Delete Backup',
      'Are you sure you want to delete this backup? This action cannot be undone.',
      () => {
        this.adminDashboardService
          .deleteBackup(backupId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (response) => {
              if (response.success) {
                this.loadBackups();
                this.showSnackbar.emit({ message: 'Backup deleted successfully.', type: 'success' });
              } else {
                this.showSnackbar.emit({
                  message: response.message || 'Failed to delete backup',
                  type: 'error',
                });
              }
            },
            error: (error: Error) => {
              console.error('Error deleting backup:', error);
              this.showSnackbar.emit({ message: 'Failed to delete backup', type: 'error' });
            },
          });
      }
    );
  }

  cleanupBackups(): void {
    this.cleanupKeepCount.set(10);
    this.openConfirmationDialog(
      'Cleanup Old Backups',
      'Delete all but the most recent completed backups.',
      () => {
        const keep = Math.max(1, Math.floor(this.cleanupKeepCount()));
        this.backupActionLoading.set(true);

        this.adminDashboardService
          .cleanupBackups(keep)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (response) => {
              if (response.success) {
                this.loadBackups();
                this.showSnackbar.emit({
                  message: `Cleaned up old backups. Keeping the last ${keep}.`,
                  type: 'success',
                });
              } else {
                this.showSnackbar.emit({
                  message: response.message || 'Failed to cleanup backups',
                  type: 'error',
                });
              }
              this.backupActionLoading.set(false);
            },
            error: (error: Error) => {
              console.error('Error cleaning up backups:', error);
              this.showSnackbar.emit({ message: 'Failed to cleanup backups', type: 'error' });
              this.backupActionLoading.set(false);
            },
          });
      }
    );
  }

  // Scheduled backup settings
  onScheduledFrequencyChange(value: string): void {
    // Type guard to validate frequency value
    const validFrequencies: readonly ('daily' | 'weekly' | 'monthly')[] = ['daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(value as 'daily' | 'weekly' | 'monthly')) {
      console.warn('Invalid frequency value received:', value);
      return;
    }
    
    const frequency = value as 'daily' | 'weekly' | 'monthly';
    const previous = this.scheduledBackupFrequency();
    if (frequency === previous) {
      return;
    }

    this.scheduledBackupFrequency.set(frequency);
    this.scheduleSettingsSaving.set(true);

    this.adminDashboardService
      .updateScheduledBackupSettings(
        this.scheduledBackupEnabled(),
        frequency,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.scheduleSettingsSaving.set(false);
          if (response.success && response.data) {
            this.scheduledBackupRunTime.set(response.data.run_time);
            this.scheduledBackupTimezone.set(response.data.timezone);
            this.showSnackbar.emit({
              message: 'Backup frequency saved.',
              type: 'success',
            });
          } else {
            this.scheduledBackupFrequency.set(previous);
            this.showSnackbar.emit({
              message:
                response.message || 'Failed to save backup frequency',
              type: 'error',
            });
          }
        },
        error: (error: Error) => {
          console.error(
            'Error updating backup frequency:',
            error,
          );
          this.scheduleSettingsSaving.set(false);
          this.scheduledBackupFrequency.set(previous);
          this.showSnackbar.emit({
            message: 'Failed to save backup frequency',
            type: 'error',
          });
        },
      });
  }

  toggleScheduledBackups(): void {
    const newEnabled = !this.scheduledBackupEnabled();
    const frequency = this.scheduledBackupFrequency();

    this.scheduleSettingsSaving.set(true);

    this.adminDashboardService
      .updateScheduledBackupSettings(
        newEnabled,
        frequency,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.scheduleSettingsSaving.set(false);
          if (response.success && response.data) {
            this.scheduledBackupEnabled.set(newEnabled);
            this.scheduledBackupRunTime.set(response.data.run_time);
            this.scheduledBackupTimezone.set(response.data.timezone);
            this.showSnackbar.emit({
              message: newEnabled
                ? 'Scheduled backups enabled successfully.'
                : 'Scheduled backups disabled successfully.',
              type: 'success',
            });
          } else {
            this.showSnackbar.emit({
              message:
                response.message
                || 'Failed to update scheduled backup settings',
              type: 'error',
            });
          }
        },
        error: (error: Error) => {
          console.error(
            'Error updating scheduled backup settings:',
            error,
          );
          this.scheduleSettingsSaving.set(false);
          this.showSnackbar.emit({
            message: 'Failed to update scheduled backup settings',
            type: 'error',
          });
        },
      });
  }

  // Pagination helpers
  backupPerPage(): number {
    return this.backupHistoryPageSize();
  }

  previousBackupHistoryPage(): void {
    if (this.backupHistoryPage() > 1) {
      this.backupHistoryPage.update((page) => page - 1);
      this.loadBackups();
    }
  }

  nextBackupHistoryPage(): void {
    if (this.backupHistoryPage() < this.backupTotalPages()) {
      this.backupHistoryPage.update((page) => page + 1);
      this.loadBackups();
    }
  }

  goToBackupPage(page: number): void {
    if (page >= 1 && page <= this.backupTotalPages()) {
      this.backupHistoryPage.set(page);
      this.loadBackups();
    }
  }

  getBackupPageNumbers(): number[] {
    const total = this.backupTotalPages();
    const current = this.backupHistoryPage();
    const pages: number[] = [];

    if (total <= 7) {
      for (let page = 1; page <= total; page += 1) {
        pages.push(page);
      }
    } else {
      pages.push(1);

      if (current > 3) {
        pages.push(-1);
      }

      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let page = start; page <= end; page += 1) {
        pages.push(page);
      }

      if (current < total - 2) {
        pages.push(-1);
      }

      pages.push(total);
    }

    return pages;
  }
}
