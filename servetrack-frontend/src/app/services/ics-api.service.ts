import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AiSuggestionsResponse,
  ApplySuggestionPayload,
  IcsResourceResponse,
} from '../models/ics';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class IcsApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/ics`;

  private ensureCsrf(): Observable<void> {
    return this.authService.ensureCsrf$();
  }

  /**
   * Create or fetch the ICS for a given RSVP. The backend is idempotent —
   * if an ICS already exists for the RSVP, it is returned with status 200
   * instead of being duplicated. When team_ids is omitted, all global teams
   * are auto-attached.
   */
  createForRsvp(rsvpId: number, name: string): Observable<IcsResourceResponse> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<IcsResourceResponse>(
          this.apiUrl,
          { rsvp_id: rsvpId, name },
          { withCredentials: true },
        ),
      ),
    );
  }

  /**
   * Fetch AI-generated team assignment suggestions for an ICS.
   */
  getAiSuggestions(icsId: number): Observable<AiSuggestionsResponse> {
    return this.http.get<AiSuggestionsResponse>(
      `${this.apiUrl}/${icsId}/ai-suggestions`,
      { withCredentials: true },
    );
  }

  /**
   * Persist accepted AI suggestions to the ics_volunteer table.
   */
  applyAiSuggestions(
    icsId: number,
    suggestions: ApplySuggestionPayload[],
  ): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<{ message: string }>(
          `${this.apiUrl}/${icsId}/apply-suggestions`,
          { suggestions },
          { withCredentials: true },
        ),
      ),
    );
  }
}
