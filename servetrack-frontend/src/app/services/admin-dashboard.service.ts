import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationItem } from '../models/notification-item';
import { PerformanceMetric } from '../models/performance-metric';
import { VolunteerUser } from '../models/user';

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

export interface UpcomingEventItem {
  id: number;
  title: string;
  date: string | null;
  responses_count: number;
  status: string;
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
  upcomingEventsList?: UpcomingEventItem[];
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
    });
  }

  getArchivedVolunteers(): Observable<VolunteersResponse> {
    return this.http.get<VolunteersResponse>(`${environment.apiUrl}/volunteers?per_page=100&archived=true`, {
      withCredentials: true,
    });
  }

  softDeleteVolunteer(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${environment.apiUrl}/volunteers/${id}/soft-delete`, {}, {
      withCredentials: true,
    });
  }

  restoreVolunteer(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${environment.apiUrl}/volunteers/${id}/restore`, {}, {
      withCredentials: true,
    });
  }

  updateVolunteer(id: number, data: Partial<VolunteerUser>): Observable<ApiResponse<VolunteerUser>> {
    return this.http.put<ApiResponse<VolunteerUser>>(`${environment.apiUrl}/volunteers/${id}`, data, {
      withCredentials: true,
    });
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

  fetchAttendanceFromRsvp(rsvpId?: number): Observable<ApiResponse<any[]>> {
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

  markAllPresent(rsvpId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${environment.apiUrl}/admin/attendance/mark-all-present`,
      { rsvp_id: rsvpId },
      { withCredentials: true }
    ).pipe(
      catchError((error) => {
        console.error('Error marking all present:', error);
        return of({
          success: false,
          message: error.error?.message || 'Failed to mark all present',
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

  fetchAttendancePhotos(archived: boolean = false): Observable<ApiResponse<any>> {
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

  sendEmailBroadcast(
    rsvpId: number | null,
    audience: 'all' | 'voted' | 'not_voted',
    message: string
  ): Observable<ApiResponse<void>> {
    const payload = {
      rsvp_id: rsvpId,
      audience,
      message,
    };
    return this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/email/broadcast`,
      payload,
      { withCredentials: true }
    ).pipe(
      catchError((error) => {
        console.error('Error sending email broadcast:', error);
        return of({
          success: false,
          message: error.error?.message || 'Failed to queue email broadcast',
          data: null as any,
        });
      })
    );
  }
}


