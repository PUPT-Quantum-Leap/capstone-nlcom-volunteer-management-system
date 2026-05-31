import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BackupRecord {
  id: number;
  name: string;
  file_path: string;
  size_bytes: number;
  type: 'automatic' | 'manual';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackupListResponse {
  success: boolean;
  data: BackupRecord[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface BackupScheduleSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  run_time: string;
  timezone: string;
}

export interface BackupStats {
  total_backups: number;
  completed_backups: number;
  failed_backups: number;
  latest_backup: BackupRecord | null;
  total_size_bytes: number;
  total_size_formatted: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class BackupApiService {
  private http = inject(HttpClient);
  private readonly hiddenPath = `${environment.apiUrl}/_db`;

  getBackups(page: number = 1, perPage: number = 10, type?: string, status?: string): Observable<BackupListResponse> {
    let url = `${this.hiddenPath}?page=${page}&per_page=${perPage}`;
    if (type) url += `&type=${type}`;
    if (status) url += `&status=${status}`;

    return this.http.get<BackupListResponse>(url, { withCredentials: true }).pipe(
      catchError(() => of({
        success: false,
        data: [],
        pagination: { current_page: 1, last_page: 1, per_page: perPage, total: 0 },
      }))
    );
  }

  createBackup(type: 'manual' | 'automatic' = 'manual', description?: string): Observable<ApiResponse<BackupRecord>> {
    const body = { type, description };

    return this.http.post<ApiResponse<BackupRecord>>(`${this.hiddenPath}`, body, { withCredentials: true }).pipe(
      catchError(() => of({ success: false, message: 'Failed to create backup', data: {} as BackupRecord }))
    );
  }

  getBackup(id: number): Observable<ApiResponse<BackupRecord>> {
    return this.http.get<ApiResponse<BackupRecord>>(`${this.hiddenPath}/${id}`, { withCredentials: true }).pipe(
      catchError(() => of({ success: false, message: 'Failed to fetch backup', data: {} as BackupRecord }))
    );
  }

  deleteBackup(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.hiddenPath}/${id}`, { withCredentials: true }).pipe(
      catchError(() => of({ success: false, message: 'Failed to delete backup' } as ApiResponse<void>))
    );
  }

  downloadBackup(id: number): Observable<Blob> {
    return this.http.get(`${this.hiddenPath}/${id}/download`, {
      withCredentials: true,
      responseType: 'blob',
    }).pipe(
      catchError(() => { throw new Error('Failed to download backup'); })
    );
  }

  restoreBackup(id: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.hiddenPath}/${id}/restore`, {}, { withCredentials: true }).pipe(
      catchError(() => of({ success: false, message: 'Failed to restore backup' } as ApiResponse<void>))
    );
  }

  getBackupStats(): Observable<ApiResponse<BackupStats>> {
    return this.http.get<ApiResponse<BackupStats>>(`${this.hiddenPath}/stats`, { withCredentials: true }).pipe(
      catchError(() => of({
        success: false,
        message: 'Failed to fetch backup statistics',
        data: {
          total_backups: 0,
          completed_backups: 0,
          failed_backups: 0,
          latest_backup: null,
          total_size_bytes: 0,
          total_size_formatted: '0 B',
        },
      }))
    );
  }

  cleanupBackups(keepCount: number = 10): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.hiddenPath}/cleanup`, { keep_count: keepCount }, { withCredentials: true }).pipe(
      catchError(() => of({ success: false, message: 'Failed to cleanup backups' } as ApiResponse<void>))
    );
  }

  getScheduledBackupSettings(): Observable<ApiResponse<BackupScheduleSettings>> {
    return this.http.get<ApiResponse<BackupScheduleSettings>>(`${this.hiddenPath}/schedule`, { withCredentials: true }).pipe(
      catchError(() => of({
        success: false,
        message: 'Failed to fetch scheduled backup settings',
        data: { enabled: false, frequency: 'weekly' as const, run_time: '02:00', timezone: 'UTC' },
      }))
    );
  }

  updateScheduledBackupSettings(enabled: boolean, frequency: 'daily' | 'weekly' | 'monthly'): Observable<ApiResponse<BackupScheduleSettings>> {
    return this.http.put<ApiResponse<BackupScheduleSettings>>(
      `${this.hiddenPath}/schedule`,
      { enabled, frequency },
      { withCredentials: true }
    ).pipe(
      catchError(() => of({
        success: false,
        message: 'Failed to update scheduled backup settings',
        data: { enabled, frequency, run_time: '02:00', timezone: 'UTC' },
      }))
    );
  }
}
