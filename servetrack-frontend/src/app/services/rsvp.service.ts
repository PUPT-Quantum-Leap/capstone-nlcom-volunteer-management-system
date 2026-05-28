import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap } from 'rxjs';
import { Rsvp, RsvpResponse, RsvpNotification } from '../models/rsvp';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class RsvpService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + '/rsvp';
  private authService = inject(AuthService);

  private rsvpCache = signal<{ data: Rsvp[] } | null>(null);

  getCachedRsvps(): { data: Rsvp[] } | null {
    return this.rsvpCache();
  }

  private ensureCsrf(): Observable<void> {
    return this.authService.ensureCsrf$();
  }

  getRsvps(perPage?: number): Observable<{ data: Rsvp[] }> {
    let url = this.apiUrl;
    if (perPage) {
      url += `?per_page=${perPage}`;
    }
    return this.http.get<{ data: Rsvp[] }>(url, { withCredentials: true }).pipe(
      tap((response) => this.rsvpCache.set(response)),
    );
  }

  getRsvpById(id: number | string): Observable<{ data: Rsvp }> {
    return this.http.get<{ data: Rsvp }>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  createRsvp(body: Record<string, unknown>): Observable<Rsvp> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<Rsvp>(this.apiUrl, body, { withCredentials: true }))
    );
  }

  updateRsvp(id: number, body: Record<string, unknown>): Observable<Rsvp> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.put<Rsvp>(`${this.apiUrl}/${id}`, body, { withCredentials: true }))
    );
  }

  deleteRsvp(id: number): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`, { withCredentials: true }))
    );
  }

  updateRsvpStatus(
    id: number,
    status: 'active' | 'closed' | 'draft',
  ): Observable<{ message: string; status: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.patch<{ message: string; status: string }>(`${this.apiUrl}/${id}/status`, {
        status,
      }, { withCredentials: true }))
    );
  }

  vote(rsvpId: number, timeSlotId: number): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<{ message: string }>(`${this.apiUrl}/${rsvpId}/vote`, {
        time_slot_id: timeSlotId,
      }, { withCredentials: true }))
    );
  }

  respond(rsvpId: number, timeSlotId: number): Observable<{ message: string }> {
    return this.vote(rsvpId, timeSlotId);
  }

  checkIn(rsvpId: number, volunteerId: number): Observable<{ success: boolean }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<{ success: boolean }>(`${this.apiUrl}/${rsvpId}/check-in`, {
        volunteer_id: volunteerId,
      }, { withCredentials: true }))
    );
  }

  checkOut(rsvpId: number, volunteerId: number): Observable<{ success: boolean }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<{ success: boolean }>(`${this.apiUrl}/${rsvpId}/check-out`, {
        volunteer_id: volunteerId,
      }, { withCredentials: true }))
    );
  }

  getAttendance(rsvpId: number): Observable<{ total: number; checked_in: number; checked_out: number; no_show: number; registered: number }> {
    return this.http.get<{ total: number; checked_in: number; checked_out: number; no_show: number; registered: number }>(`${this.apiUrl}/${rsvpId}/attendance`, { withCredentials: true });
  }


  notifySms(rsvpId: number): Observable<{ success: boolean; message: string; total: number; sent: number; failed: number }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<{ success: boolean; message: string; total: number; sent: number; failed: number }>(`${this.apiUrl}/${rsvpId}/notify-sms`, {}, { withCredentials: true }))
    );
  }

  /**
   * Get current volunteer's response for an RSVP.
   */
  getMyResponse(rsvpId: number): Observable<{ data: RsvpResponse }> {
    return this.http.get<{ data: RsvpResponse }>(`${this.apiUrl}/${rsvpId}/my-response`, { withCredentials: true });
  }

  /**
   * Update an existing RSVP response (volunteer edits their response).
   */
  updateRsvpResponse(rsvpId: number, timeSlotId: number): Observable<{ message: string; remaining_edits: number }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.put<{ message: string; remaining_edits: number }>(`${this.apiUrl}/${rsvpId}/response`, {
        time_slot_id: timeSlotId,
      }, { withCredentials: true }))
    );
  }

  /**
   * Get RSVP notifications for authenticated volunteer.
   */
  getNotifications(): Observable<{ data: RsvpNotification[] }> {
    return this.http.get<{ data: RsvpNotification[] }>(`${environment.apiUrl}/notifications/rsvp`, { withCredentials: true });
  }

  /**
   * Mark a notification as read.
   */
  markNotificationAsRead(notificationId: number): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.patch<{ message: string }>(`${environment.apiUrl}/notifications/${notificationId}/read`, {}, { withCredentials: true }))
    );
  }

  /**
   * Mark all RSVP notifications as read.
   */
  markAllNotificationsAsRead(): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.patch<{ message: string }>(`${environment.apiUrl}/notifications/rsvp/read-all`, {}, { withCredentials: true }))
    );
  }
}
