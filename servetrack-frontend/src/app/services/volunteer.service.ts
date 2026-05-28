import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, switchMap, tap, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { Attendance, AttendanceStats, AttendancePeriod } from '../models/attendance';
import { VolunteerPoll } from '../models/volunteer-poll';
import { VolunteerProfileResponse } from '../models/volunteer-profile';
import { AuthService } from './auth.service';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class VolunteerService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/volunteer`;

  /** In-memory cache of the last fetched profile. */
  private profileCache = signal<VolunteerProfileResponse | null>(null);

  /**
   * Returns the cached profile synchronously if available.
   * Useful for instantly hydrating components without waiting for an HTTP roundtrip.
   */
  getCachedProfile(): VolunteerProfileResponse | null {
    return this.profileCache();
  }

  /** Fetch the authenticated volunteer's profile — updates the cache on success. */
  getProfile(): Observable<ApiResponse<VolunteerProfileResponse>> {
    return this.http
      .get<ApiResponse<VolunteerProfileResponse>>(`${this.baseUrl}/profile`, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          if (response.success && response.data) {
            this.profileCache.set(response.data);
          }
        }),
        catchError((error) => {
          console.error('[VolunteerService] getProfile failed:', error);
          throw error;
        }),
      );
  }

  /** Update the authenticated volunteer's profile — updates the cache on success. */
  updateProfile(
    payload: Record<string, unknown>,
  ): Observable<ApiResponse<VolunteerProfileResponse>> {
    return this.authService.ensureCsrf$().pipe(
      switchMap(() =>
        this.http.put<ApiResponse<VolunteerProfileResponse>>(`${this.baseUrl}/profile`, payload, {
          withCredentials: true,
        })
      ),
      tap((response) => {
        if (response.success && response.data) {
          this.profileCache.set(response.data);
        }
      }),
      catchError((error) => {
        console.error('[VolunteerService] updateProfile failed:', error);
        throw error;
      }),
    );
  }

  /** Upload the volunteer's profile photo. */
  uploadProfilePhoto(file: File): Observable<ApiResponse<{ profile_photo_url: string }>> {
    const formData = new FormData();
    formData.append('photo', file);

    return this.authService.ensureCsrf$().pipe(
      switchMap(() =>
        this.http.post<ApiResponse<{ profile_photo_url: string }>>(`${this.baseUrl}/profile/photo`, formData, {
          withCredentials: true,
        })
      ),
      catchError((error) => {
        console.error('[VolunteerService] uploadProfilePhoto failed:', error);
        throw error;
      }),
    );
  }

  /**
   * List attendance records with optional period filter and search term.
   */
  getAttendance(
    period?: AttendancePeriod,
    search?: string,
    startDate?: string,
    endDate?: string
  ): Observable<ApiResponse<Attendance[]>> {
    let params = new HttpParams();
    if (period) {
      params = params.set('period', period);
    }
    if (search) {
      params = params.set('search', search);
    }
    if (startDate) {
      params = params.set('start_date', startDate);
    }
    if (endDate) {
      params = params.set('end_date', endDate);
    }

    return this.http
      .get<ApiResponse<Attendance[]>>(`${this.baseUrl}/attendance`, {
        withCredentials: true,
        params,
      })
      .pipe(
        tap((response) => {
          console.log('[VolunteerService] getAttendance raw response:', response);
        }),
        catchError((error) => {
          console.error('[VolunteerService] getAttendance failed:', error);
          throw error;
        }),
      );
  }

  /** Fetch attendance statistics (total, daily, weekly, monthly). */
  getAttendanceStats(): Observable<ApiResponse<AttendanceStats>> {
    return this.http
      .get<ApiResponse<AttendanceStats>>(`${this.baseUrl}/attendance/stats`, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('[VolunteerService] getAttendanceStats failed:', error);
        throw error;
      }),
    );
  }

  /** Fetch volunteer polls from the backend. */
  getPolls(): Observable<ApiResponse<VolunteerPoll[]>> {
    return this.http
      .get<ApiResponse<VolunteerPoll[]>>(`${this.baseUrl}/polls`, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('[VolunteerService] getPolls failed:', error);
          throw error;
        }),
      );
  }

  /** Submit a vote for a specific poll. */
  submitPollVote(pollId: number): Observable<ApiResponse<VolunteerPoll>> {
    return this.authService.ensureCsrf$().pipe(
      switchMap(() =>
        this.http.post<ApiResponse<VolunteerPoll>>(
          `${this.baseUrl}/polls/${pollId}/vote`,
          {},
          {
            withCredentials: true,
          },
        ),
      ),
      catchError((error) => {
        console.error('[VolunteerService] submitPollVote failed:', error);
        throw error;
      }),
    );
  }
}
