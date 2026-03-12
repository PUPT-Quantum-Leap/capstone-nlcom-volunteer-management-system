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
}

