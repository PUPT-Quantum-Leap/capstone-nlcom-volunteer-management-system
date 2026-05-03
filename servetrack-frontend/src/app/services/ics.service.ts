import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import {
  Ics,
  CreateIcsRequest,
  UpdateIcsRequest,
  AiSuggestion,
  AiSuggestionsResponse,
  AssignVolunteerRequest,
  RsvpVolunteer,
} from '../models/ics';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class IcsService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + '/ics';
  private authService = inject(AuthService);

  private ensureCsrf(): Observable<void> {
    return this.authService.ensureCsrf$();
  }

  /**
   * Get all ICS entries.
   */
  getIcs(): Observable<{ data: Ics[] }> {
    return this.http.get<{ data: Ics[] }>(this.apiUrl, { withCredentials: true });
  }

  /**
   * Get a single ICS by ID.
   */
  getIcsById(id: number): Observable<{ data: Ics }> {
    return this.http.get<{ data: Ics }>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  /**
   * Create a new ICS.
   */
  createIcs(body: CreateIcsRequest): Observable<Ics> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<Ics>(this.apiUrl, body, { withCredentials: true }))
    );
  }

  /**
   * Update an existing ICS.
   */
  updateIcs(id: number, body: UpdateIcsRequest): Observable<Ics> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.put<Ics>(`${this.apiUrl}/${id}`, body, { withCredentials: true }))
    );
  }

  /**
   * Delete an ICS.
   */
  deleteIcs(id: number): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`, { withCredentials: true }))
    );
  }

  /**
   * Get volunteers who RSVP'd for a specific event.
   */
  getRsvpVolunteers(rsvpId: number): Observable<{ data: RsvpVolunteer[] }> {
    return this.http.get<{ data: RsvpVolunteer[] }>(
      `${this.apiUrl}/${rsvpId}/rsvp-volunteers`,
      { withCredentials: true }
    );
  }

  /**
   * Get AI suggestions for team assignments.
   */
  getAiSuggestions(icsId: number): Observable<AiSuggestionsResponse> {
    return this.http.get<AiSuggestionsResponse>(
      `${this.apiUrl}/${icsId}/ai-suggestions`,
      { withCredentials: true }
    );
  }

  /**
   * Apply AI suggestions to assign volunteers to teams.
   */
  applyAiSuggestions(icsId: number, suggestions: AiSuggestion[]): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<{ message: string }>(
          `${this.apiUrl}/${icsId}/apply-suggestions`,
          { suggestions },
          { withCredentials: true }
        )
      )
    );
  }

  /**
   * Manually assign a volunteer to a team.
   */
  assignVolunteer(icsId: number, body: AssignVolunteerRequest): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<{ message: string }>(
          `${this.apiUrl}/${icsId}/assign-volunteer`,
          body,
          { withCredentials: true }
        )
      )
    );
  }

  /**
   * Remove a volunteer from an ICS.
   */
  removeVolunteer(icsId: number, volunteerId: number): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<{ message: string }>(
          `${this.apiUrl}/${icsId}/remove-volunteer`,
          { volunteer_id: volunteerId },
          { withCredentials: true }
        )
      )
    );
  }
}
