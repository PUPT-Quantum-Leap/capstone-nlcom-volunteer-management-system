import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { RsvpNotification } from '../models/rsvp';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + '/notifications';
  private authService = inject(AuthService);

  private ensureCsrf(): Observable<void> {
    return this.authService.ensureCsrf$();
  }

  /**
   * Get RSVP notifications for authenticated volunteer.
   */
  getRsvpNotifications(): Observable<{ data: RsvpNotification[] }> {
    return this.http.get<{ data: RsvpNotification[] }>(`${this.apiUrl}/rsvp`, { withCredentials: true });
  }

  /**
   * Mark a notification as read.
   */
  markAsRead(notificationId: number): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.patch<{ message: string }>(`${this.apiUrl}/${notificationId}/read`, {}, { withCredentials: true }))
    );
  }

  /**
   * Mark all RSVP notifications as read.
   */
  markAllRsvpAsRead(): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.patch<{ message: string }>(`${this.apiUrl}/rsvp/read-all`, {}, { withCredentials: true }))
    );
  }
}
