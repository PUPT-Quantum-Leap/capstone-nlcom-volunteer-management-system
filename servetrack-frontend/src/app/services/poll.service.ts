import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Poll } from '../models/poll';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PollService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + '/polls';

  getPolls(): Observable<{ data: Poll[] }> {
    return this.http.get<{ data: Poll[] }>(this.apiUrl);
  }

  getPollById(id: number): Observable<{ data: Poll }> {
    return this.http.get<{ data: Poll }>(`${this.apiUrl}/${id}`);
  }

  /** Body is sent as-is to the backend; must use snake_case field names. */
  createPoll(body: Record<string, unknown>): Observable<{ data: Poll }> {
    return this.http.post<{ data: Poll }>(this.apiUrl, body);
  }

  /** Body is sent as-is to the backend; must use snake_case field names. */
  updatePoll(id: number, body: Record<string, unknown>): Observable<{ data: Poll }> {
    return this.http.put<{ data: Poll }>(`${this.apiUrl}/${id}`, body);
  }

  deletePoll(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  updatePollStatus(
    id: number,
    status: 'active' | 'closed' | 'draft',
  ): Observable<{ message: string; status: string }> {
    return this.http.patch<{ message: string; status: string }>(`${this.apiUrl}/${id}/status`, {
      status,
    });
  }

  vote(pollId: number, optionId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${pollId}/vote`, {
      option_id: optionId,
    });
  }
}
