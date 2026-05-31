import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BackupAccessService } from '../services/backup-access.service';

export const backupAccessGuard = () => {
  const backupAccess = inject(BackupAccessService);
  const router = inject(Router);

  if (backupAccess.consumeAccess()) {
    return true;
  }

  return router.parseUrl('/admin-dashboard/dashboard');
};
