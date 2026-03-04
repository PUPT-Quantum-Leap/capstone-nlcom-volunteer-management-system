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
}

