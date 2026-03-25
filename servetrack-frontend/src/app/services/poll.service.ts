import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { Poll } from '../models/poll';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class PollService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + '/polls';
  private authService = inject(AuthService);

  private ensureCsrf(): Observable<void> {
    return this.authService.ensureCsrf$();
  }

  getPolls(): Observable<{ data: Poll[] }> {
    return this.http.get<{ data: Poll[] }>(this.apiUrl, { withCredentials: true });
  }

  getPollById(id: number): Observable<{ data: Poll }> {
    return this.http.get<{ data: Poll }>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  /** Body is sent as-is to the backend; must use snake_case field names. */
  createPoll(body: Record<string, unknown>): Observable<{ data: Poll }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<{ data: Poll }>(this.apiUrl, body, { withCredentials: true }))
    );
  }

  /** Body is sent as-is to the backend; must use snake_case field names. */
  updatePoll(id: number, body: Record<string, unknown>): Observable<{ data: Poll }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.put<{ data: Poll }>(`${this.apiUrl}/${id}`, body, { withCredentials: true }))
    );
  }

  deletePoll(id: number): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`, { withCredentials: true }))
    );
  }

  updatePollStatus(
    id: number,
    status: 'active' | 'closed' | 'draft',
  ): Observable<{ message: string; status: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.patch<{ message: string; status: string }>(`${this.apiUrl}/${id}/status`, {
        status,
      }, { withCredentials: true }))
    );
  }

  vote(pollId: number, optionId: number): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<{ message: string }>(`${this.apiUrl}/${pollId}/vote`, {
        option_id: optionId,
      }, { withCredentials: true }))
    );
  }
}
