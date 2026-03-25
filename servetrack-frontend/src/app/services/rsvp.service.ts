import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { Rsvp } from '../models/rsvp';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class RsvpService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + '/rsvp';
  private authService = inject(AuthService);

  private ensureCsrf(): Observable<void> {
    return this.authService.ensureCsrf$();
  }

  getRsvps(): Observable<{ data: Rsvp[] }> {
    return this.http.get<{ data: Rsvp[] }>(this.apiUrl, { withCredentials: true });
  }

  getRsvpById(id: number): Observable<{ data: Rsvp }> {
    return this.http.get<{ data: Rsvp }>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  createRsvp(body: Record<string, unknown>): Observable<{ data: Rsvp }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<{ data: Rsvp }>(this.apiUrl, body, { withCredentials: true }))
    );
  }

  updateRsvp(id: number, body: Record<string, unknown>): Observable<{ data: Rsvp }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.put<{ data: Rsvp }>(`${this.apiUrl}/${id}`, body, { withCredentials: true }))
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

  notifyFacebook(rsvpId: number): Observable<{ success: boolean; message: string; total: number; sent: number; failed: number }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<{ success: boolean; message: string; total: number; sent: number; failed: number }>(`${this.apiUrl}/${rsvpId}/notify-facebook`, {}, { withCredentials: true }))
    );
  }

  notifySms(rsvpId: number): Observable<{ success: boolean; message: string; total: number; sent: number; failed: number }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<{ success: boolean; message: string; total: number; sent: number; failed: number }>(`${this.apiUrl}/${rsvpId}/notify-sms`, {}, { withCredentials: true }))
    );
  }
}
