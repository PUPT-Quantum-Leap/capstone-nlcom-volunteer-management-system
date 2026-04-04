import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Poll } from '../models/poll';

@Injectable({
  providedIn: 'root',
})
export class PollService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl + '/polls';

  private ensureCsrf(): Observable<void> {
    return this.authService.ensureCsrf$();
  }

  getPolls(): Observable<{ data: Poll[] }> {
    return this.http.get<{ data: Poll[] }>(this.apiUrl, { withCredentials: true });
  }

  vote(pollId: number, optionId: number): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<{ message: string }>(
          `${this.apiUrl}/${pollId}/vote`,
          { option_id: optionId },
          { withCredentials: true },
        ),
      ),
    );
  }
}
