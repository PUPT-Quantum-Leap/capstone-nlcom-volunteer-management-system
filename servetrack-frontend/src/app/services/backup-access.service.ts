import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class BackupAccessService {
  private backupAccessGranted = signal(false);
  readonly accessGranted = this.backupAccessGranted.asReadonly();

  grantAccess(): void {
    this.backupAccessGranted.set(true);
  }

  revokeAccess(): void {
    this.backupAccessGranted.set(false);
  }

  consumeAccess(): boolean {
    if (this.backupAccessGranted()) {
      this.backupAccessGranted.set(false);
      return true;
    }
    return false;
  }
}
