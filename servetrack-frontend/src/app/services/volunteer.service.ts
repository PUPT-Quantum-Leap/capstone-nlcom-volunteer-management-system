import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Attendance, AttendanceStats, CreateAttendancePayload } from '../models/attendance';
import { VolunteerProfileResponse } from '../models/volunteer-profile';
import { AuthService } from './auth.service';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export type AttendancePeriod = 'daily' | 'weekly' | 'monthly';

@Injectable({
  providedIn: 'root',
})
export class VolunteerService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/volunteer`;

  /** Fetch the authenticated volunteer's profile. */
  getProfile(): Observable<ApiResponse<VolunteerProfileResponse>> {
    return this.http
      .get<ApiResponse<VolunteerProfileResponse>>(`${this.baseUrl}/profile`, {
        withCredentials: true,
      })
      .pipe(
        catchError(() => of({ success: false, data: null as unknown as VolunteerProfileResponse })),
      );
  }

  /** Update the authenticated volunteer's profile. */
  updateProfile(
    payload: Record<string, unknown>,
  ): Observable<ApiResponse<VolunteerProfileResponse>> {
    return this.authService.ensureCsrf$().pipe(
      switchMap(() => 
        this.http.put<ApiResponse<VolunteerProfileResponse>>(`${this.baseUrl}/profile`, payload, {
          withCredentials: true,
        })
      ),
      catchError((error) => {
        // Return the error message from the server if available
        const errorMessage = error.error?.message || 'Failed to update profile';
        return of({ success: false, message: errorMessage, data: null as unknown as VolunteerProfileResponse });
      }),
    );
  }

  /**
   * List attendance records with optional period filter and search term.
   */
  getAttendance(period?: AttendancePeriod, search?: string): Observable<ApiResponse<Attendance[]>> {
    let params = new HttpParams();
    if (period) {
      params = params.set('period', period);
    }
    if (search) {
      params = params.set('search', search);
    }

    return this.http
      .get<ApiResponse<Attendance[]>>(`${this.baseUrl}/attendance`, {
        withCredentials: true,
        params,
      })
      .pipe(catchError(() => of({ success: false, data: [] })));
  }

  /** Submit a new manual attendance entry. */
  createAttendance(payload: CreateAttendancePayload): Observable<ApiResponse<Attendance>> {
    return this.authService.ensureCsrf$().pipe(
      switchMap(() => 
        this.http.post<ApiResponse<Attendance>>(`${this.baseUrl}/attendance`, payload, {
          withCredentials: true,
        })
      ),
      catchError(() => of({ success: false, data: null as unknown as Attendance })),
    );
  }

  /** Fetch attendance statistics (total, daily, weekly, monthly). */
  getAttendanceStats(): Observable<ApiResponse<AttendanceStats>> {
    return this.http
      .get<ApiResponse<AttendanceStats>>(`${this.baseUrl}/attendance/stats`, {
        withCredentials: true,
      })
      .pipe(catchError(() => of({ success: false, data: null as unknown as AttendanceStats })));
  }
}
