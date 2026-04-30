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

  // Outputs
  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  // Signals
  backupRecords = signal<BackupRecord[]>([]);
  backupHistoryPage = signal(1);
  backupHistoryPageSize = signal(5);
  backupActionLoading = signal(false);
  scheduledBackupEnabled = signal(false);
  scheduledBackupFrequency = signal<'daily' | 'weekly' | 'monthly'>('weekly');

  // Confirmation dialog signals
  showConfirmationDialog = signal(false);
  confirmationDialogTitle = signal('');
  confirmationDialogMessage = signal('');
  confirmationDialogAction = signal<() => void>(() => {});

  // Computed
  backupTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.backupRecords().length / this.backupHistoryPageSize()))
  );

  paginatedBackupRecords = computed(() => {
    const page = this.backupHistoryPage();
    const size = this.backupHistoryPageSize();
    const start = (page - 1) * size;
    const end = start + size;

    return this.backupRecords()
      .slice()
      .sort((a, b) => {
        const bDate = this.safeDate(b.created_at)?.getTime() ?? 0;
        const aDate = this.safeDate(a.created_at)?.getTime() ?? 0;
        return bDate - aDate;
      })
      .slice(start, end);
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
        } else {
          this.backupRecords.set([]);
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
            this.backupRecords.update((items) => [response.data, ...items]);
            this.backupHistoryPage.set(1);
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
            this.backupRecords.set(response.data);
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
                this.backupRecords.update((items) => items.filter((item) => item.id !== backupId));

                const totalPages = this.backupTotalPages();
                if (this.backupHistoryPage() > totalPages) {
                  this.backupHistoryPage.set(totalPages);
                }

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

  // Scheduled backup settings
  setScheduledBackupFrequency(frequency: 'daily' | 'weekly' | 'monthly'): void {
    this.scheduledBackupFrequency.set(frequency);
  }

  toggleScheduledBackups(): void {
    const newEnabled = !this.scheduledBackupEnabled();
    const frequency = this.scheduledBackupFrequency();

    this.adminDashboardService
      .updateScheduledBackupSettings(newEnabled, frequency)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.scheduledBackupEnabled.set(newEnabled);
            this.showSnackbar.emit({
              message: newEnabled
                ? 'Scheduled backups enabled successfully.'
                : 'Scheduled backups disabled successfully.',
              type: 'success',
            });
          } else {
            this.showSnackbar.emit({
              message: response.message || 'Failed to update scheduled backup settings',
              type: 'error',
            });
          }
        },
        error: (error: Error) => {
          console.error('Error updating scheduled backup settings:', error);
          this.showSnackbar.emit({
            message: 'Failed to update scheduled backup settings',
            type: 'error',
          });
        },
      });
  }

  // Pagination
  previousBackupHistoryPage(): void {
    if (this.backupHistoryPage() > 1) {
      this.backupHistoryPage.update((page) => page - 1);
    }
  }

  nextBackupHistoryPage(): void {
    if (this.backupHistoryPage() < this.backupTotalPages()) {
      this.backupHistoryPage.update((page) => page + 1);
    }
  }
}
