import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationItem } from '../models/notification-item';
import { PerformanceMetric } from '../models/performance-metric';

export interface DashboardVolunteerRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  facebookName: string | null;
  department: string;
  status: 'active' | 'inactive';
  joined_date: string | null;
}

export interface VolunteerUser {
  volunteer_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  facebook_name: string | null;
  email: string;
  mobile_number: string;
  birthdate: string | null;
  address: string;
  educational_attainment: string;
  last_medical_examination: string | null;
  profile_photo_url: string | null;
  created_at: string;
  updated_at: string;
  positions?: string[];
}

export interface VolunteersResponse {
  success: boolean;
  data: VolunteerUser[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

export interface AdminDashboardData {
  stats: {
    totalVolunteers: number;
    activeVolunteers: number;
    upcomingEvents: number;
    completedMissions: number;
  };
  notifications: NotificationItem[];
  volunteers: DashboardVolunteerRow[];
  performanceMetrics: PerformanceMetric[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface NonResponder {
  volunteer_id: number;
  volunteer_name: string;
  volunteer_email: string;
  volunteer_department: string;
  mobile_number: string;
}

export interface NonRespondersResponse {
  success: boolean;
  message?: string;
  data: NonResponder[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
}

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

@Injectable({
  providedIn: 'root',
})
export class AdminDashboardService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  getDashboardData(): Observable<ApiResponse<AdminDashboardData>> {
    return this.http
      .get<ApiResponse<AdminDashboardData>>(`${this.baseUrl}/dashboard`, {
        withCredentials: true,
      })
      .pipe(
        catchError(() =>
          of({
            success: false,
            data: {
              stats: {
                totalVolunteers: 0,
                activeVolunteers: 0,
                upcomingEvents: 0,
                completedMissions: 0,
              },
              notifications: [],
              volunteers: [],
              performanceMetrics: [],
            },
          }),
        ),
      );
  }

  getVolunteers(): Observable<VolunteersResponse> {
    return this.http.get<VolunteersResponse>(`${environment.apiUrl}/volunteers?per_page=100`, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error fetching volunteers from database:', error);
        return of({
          success: false,
          data: [],
          meta: {
            total: 0,
            per_page: 100,
            current_page: 1,
            last_page: 1
          }
        });
      })
    );
  }

  getArchivedVolunteers(): Observable<VolunteersResponse> {
    return this.http.get<VolunteersResponse>(`${environment.apiUrl}/volunteers?per_page=100&archived=true`, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error fetching archived volunteers:', error);
        return of({
          success: false,
          data: [],
          meta: {
            total: 0,
            per_page: 100,
            current_page: 1,
            last_page: 1
          }
        });
      })
    );
  }

  softDeleteVolunteer(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${environment.apiUrl}/volunteers/${id}/soft-delete`, {}, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error soft deleting volunteer:', error);
        return of({
          success: false,
          message: 'Failed to archive volunteer'
        } as ApiResponse<void>);
      })
    );
  }

  restoreVolunteer(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${environment.apiUrl}/volunteers/${id}/restore`, {}, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error restoring volunteer:', error);
        return of({
          success: false,
          message: 'Failed to restore volunteer'
        } as ApiResponse<void>);
      })
    );
  }

  updateVolunteer(id: number, data: Partial<VolunteerUser>): Observable<ApiResponse<VolunteerUser>> {
    return this.http.put<ApiResponse<VolunteerUser>>(`${environment.apiUrl}/volunteers/${id}`, data, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error updating volunteer:', error);
        return of({
          success: false,
          message: 'Failed to update volunteer',
          data: {} as VolunteerUser,
        });
      })
    );
  }

  // Backup management methods
  getBackups(page: number = 1, perPage: number = 10, type?: string, status?: string): Observable<BackupListResponse> {
    let url = `${environment.apiUrl}/backups?page=${page}&per_page=${perPage}`;
    if (type) url += `&type=${type}`;
    if (status) url += `&status=${status}`;
    
    return this.http.get<BackupListResponse>(url, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error fetching backups:', error);
        return of({
          success: false,
          data: [],
          pagination: {
            current_page: 1,
            last_page: 1,
            per_page: perPage,
            total: 0,
          },
        });
      })
    );
  }

  createBackup(type: 'manual' | 'automatic' = 'manual', description?: string): Observable<ApiResponse<BackupRecord>> {
    const body = type ? { type, description } : {};
    
    return this.http.post<ApiResponse<BackupRecord>>(`${environment.apiUrl}/backups`, body, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error creating backup:', error);
        return of({
          success: false,
          message: 'Failed to create backup',
          data: {} as BackupRecord,
        });
      })
    );
  }

  getBackup(id: number): Observable<ApiResponse<BackupRecord>> {
    return this.http.get<ApiResponse<BackupRecord>>(`${environment.apiUrl}/backups/${id}`, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error fetching backup:', error);
        return of({
          success: false,
          message: 'Failed to fetch backup',
          data: {} as BackupRecord,
        });
      })
    );
  }

  deleteBackup(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiUrl}/backups/${id}`, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error deleting backup:', error);
        return of({
          success: false,
          message: 'Failed to delete backup',
        } as ApiResponse<void>);
      })
    );
  }

  downloadBackup(id: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/backups/${id}/download`, {
      withCredentials: true,
      responseType: 'blob',
    }).pipe(
      catchError((error) => {
        console.error('Error downloading backup:', error);
        throw new Error('Failed to download backup');
      })
    );
  }

  restoreBackup(id: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/backups/${id}/restore`, {}, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error restoring backup:', error);
        return of({
          success: false,
          message: 'Failed to restore backup',
        } as ApiResponse<void>);
      })
    );
  }

  getBackupStats(): Observable<ApiResponse<BackupStats>> {
    return this.http.get<ApiResponse<BackupStats>>(`${environment.apiUrl}/backups/stats`, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error fetching backup stats:', error);
        return of({
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
        });
      })
    );
  }

  cleanupBackups(keepCount: number = 10): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/backups/cleanup`, { keep_count: keepCount }, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error cleaning up backups:', error);
        return of({
          success: false,
          message: 'Failed to cleanup backups',
        } as ApiResponse<void>);
      })
    );
  }

  // Scheduled backup management methods
  getScheduledBackupSettings(): Observable<
    ApiResponse<BackupScheduleSettings>
  > {
    const url = `${environment.apiUrl}/backups/schedule`;
    return this.http
      .get<ApiResponse<BackupScheduleSettings>>(url, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error(
            'Error fetching scheduled backup settings:',
            error,
          );
          const fallback: ApiResponse<BackupScheduleSettings> = {
            success: false,
            message: 'Failed to fetch scheduled backup settings',
            data: {
              enabled: false,
              frequency: 'weekly',
              run_time: '02:00',
              timezone: 'UTC',
            },
          };
          return of(fallback);
        }),
      );
  }

  updateScheduledBackupSettings(
    enabled: boolean,
    frequency: 'daily' | 'weekly' | 'monthly',
  ): Observable<ApiResponse<BackupScheduleSettings>> {
    const body = { enabled, frequency };
    const url = `${environment.apiUrl}/backups/schedule`;

    return this.http
      .put<ApiResponse<BackupScheduleSettings>>(url, body, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error(
            'Error updating scheduled backup settings:',
            error,
          );
          const fallback: ApiResponse<BackupScheduleSettings> = {
            success: false,
            message: 'Failed to update scheduled backup settings',
            data: {
              enabled,
              frequency,
              run_time: '02:00',
              timezone: 'UTC',
            },
          };
          return of(fallback);
        }),
      );
  }

  // SMS configuration check
  getSmsConfigStatus(): Observable<{ configured: boolean; message?: string }> {
    return this.http.get<{ configured: boolean; message?: string }>(
      `${environment.apiUrl}/sms/config-status`,
      { withCredentials: true }
    ).pipe(
      catchError((error) => {
        console.error('Error fetching SMS config status:', error);
        return of({
          configured: false,
          message: 'Unable to verify SMS configuration',
        });
      })
    );
  }

  // Admin Profile management
  getAdminProfile(): Observable<ApiResponse<{
    id: number;
    name: string;
    email: string;
    first_name: string;
    last_name: string;
    contact_number: string | null;
    profile_photo_url: string | null;
  }>> {
    return this.http.get<ApiResponse<{
      id: number;
      name: string;
      email: string;
      first_name: string;
      last_name: string;
      contact_number: string | null;
      profile_photo_url: string | null;
    }>>(`${environment.apiUrl}/admin/profile`, { withCredentials: true }).pipe(
      catchError((error) => {
        console.error('Error fetching admin profile:', error);
        return of({
          success: false,
          message: 'Failed to fetch admin profile',
          data: {} as any,
        });
      })
    );
  }

  updateAdminProfile(data: {
    first_name: string;
    last_name: string;
    email: string;
    contact_number?: string | null;
    profile_photo?: string | null;
  }): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${environment.apiUrl}/admin/profile`, data, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error updating admin profile:', error);
        return of({
          success: false,
          message: error.error?.message || 'Failed to update profile',
          data: error.error?.errors,
        });
      })
    );
  }

  getAttendanceFromRsvp(rsvpId?: number): Observable<ApiResponse<any[]>> {
    let url = `${environment.apiUrl}/admin/attendance-from-rsvp`;
    if (rsvpId) {
      url += `?rsvp_id=${rsvpId}`;
    }
    return this.http.get<ApiResponse<any[]>>(url, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error fetching attendance from RSVP:', error);
        return of({
          success: false,
          message: 'Failed to fetch attendance from RSVP',
          data: [],
        });
      })
    );
  }

  getRsvpNonResponders(
    rsvpId: number,
    params?: { search?: string; page?: number; perPage?: number },
  ): Observable<NonRespondersResponse> {
    const query = new URLSearchParams({ rsvp_id: String(rsvpId) });
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.perPage) query.set('per_page', String(params.perPage));

    return this.http
      .get<NonRespondersResponse>(`${environment.apiUrl}/admin/rsvp-non-responders?${query}`, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('Error fetching RSVP non-responders:', error);
          return of<NonRespondersResponse>({
            success: false,
            message: 'Failed to fetch non-responders',
            data: [],
            meta: { current_page: 1, last_page: 1, total: 0, per_page: 25 },
          });
        }),
      );
  }

  updateAttendanceStatus(rsvpResponseId: number, status: 'present' | 'absent'): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${environment.apiUrl}/admin/attendance-status`,
      { rsvp_response_id: rsvpResponseId, status },
      { withCredentials: true }
    ).pipe(
      catchError((error) => {
        console.error('Error updating attendance status:', error);
        return of({
          success: false,
          message: error.error?.message || 'Failed to update attendance status',
          data: null,
        });
      })
    );
  }

  uploadAttendancePhoto(file: File): Observable<ApiResponse<{ photo: any; url: string }>> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.http.post<ApiResponse<{ photo: any; url: string }>>(
      `${environment.apiUrl}/attendance-photos`,
      formData,
      { withCredentials: true }
    ).pipe(
      catchError((error) => {
        console.error('Error uploading attendance photo:', error);
        return of({
          success: false,
          message: error.error?.message || 'Failed to upload photo',
          data: null as any
        });
      })
    );
  }

  getAttendancePhotos(archived: boolean = false): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${environment.apiUrl}/attendance-photos?archived=${archived}`,
      { withCredentials: true }
    ).pipe(
      catchError((error) => {
        console.error('Error fetching attendance photos:', error);
        return of({
          success: false,
          data: { data: [] }
        } as ApiResponse<any>);
      })
    );
  }

  deleteAttendancePhoto(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${environment.apiUrl}/attendance-photos/${id}`,
      { withCredentials: true }
    ).pipe(
      catchError((error) => {
        console.error('Error deleting attendance photo:', error);
        return of({
          success: false,
          message: error.error?.message || 'Failed to delete photo',
          data: null
        });
      })
    );
  }
}

