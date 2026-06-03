import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import {
  Ics,
  CreateIcsRequest,
  UpdateIcsRequest,
  AiSuggestion,
  MoveVolunteerRequest,
  IcsMetadata,
  AssignVolunteerRequest,
  RsvpIcsInfo,
  RsvpVolunteer,
  IcsDashboard,
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
   * Get RSVPs that have ICS records — used by the operations carousel.
   */
  getRsvpIcsList(): Observable<{ data: RsvpIcsInfo[] }> {
    return this.http.get<{ data: RsvpIcsInfo[] }>(`${this.apiUrl}/rsvp-list`, {
      withCredentials: true,
    });
  }

  /**
   * Get the frontend-ready ICS dashboard for an RSVP event.
   */
  getDashboard(rsvpId: number): Observable<{ data: IcsDashboard }> {
    return this.http.get<{ data: IcsDashboard }>(`${this.apiUrl}/dashboard`, {
      params: { rsvp_id: rsvpId },
      withCredentials: true,
    });
  }

  /**
   * Update a fixed command-role assignment.
   */
  updateCommandRole(
    icsId: number,
    roleKey: string,
    body: { assigned_name?: string | null; volunteer_id?: number | null },
  ): Observable<{ data: IcsDashboard }> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.patch<{ data: IcsDashboard }>(
          `${this.apiUrl}/${icsId}/command-roles/${roleKey}`,
          body,
          { withCredentials: true },
        ),
      ),
    );
  }

  /**
   * Move a volunteer between teams within the same ICS.
   */
  moveVolunteer(icsId: number, body: MoveVolunteerRequest): Observable<{ message: string }> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<{ message: string }>(
          `${this.apiUrl}/${icsId}/move-volunteer`,
          body,
          { withCredentials: true },
        ),
      ),
    );
  }

  /**
   * Search volunteers from the RSVP pool with optional shift filter.
   */
  searchRsvpVolunteers(rsvpId: number, shift?: string): Observable<{ data: RsvpVolunteer[] }> {
    const params: Record<string, string> = {};
    if (shift) params['shift'] = shift;

    return this.http.get<{ data: RsvpVolunteer[] }>(
      `${this.apiUrl}/${rsvpId}/rsvp-volunteers`,
      { params, withCredentials: true },
    );
  }

  /**
   * Update ICS metadata (objective, menu, meal counts).
   */
  updateMetadata(icsId: number, body: Partial<IcsMetadata>): Observable<{ data: Ics }> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.put<{ data: Ics }>(`${this.apiUrl}/${icsId}`, body, { withCredentials: true }),
      ),
    );
  }

  /**
   * Create a new ICS.
   */
  createIcs(body: CreateIcsRequest): Observable<{ data: Ics }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<{ data: Ics }>(this.apiUrl, body, { withCredentials: true }))
    );
  }

  /**
   * Update an existing ICS.
   */
  updateIcs(id: number, body: UpdateIcsRequest): Observable<{ data: Ics }> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.put<{ data: Ics }>(`${this.apiUrl}/${id}`, body, { withCredentials: true }))
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
  getAiSuggestions(icsId: number): Observable<{ data: AiSuggestion[] }> {
    return this.http.get<{ data: AiSuggestion[] }>(
      `${this.apiUrl}/${icsId}/ai-suggestions`,
      { withCredentials: true }
    );
  }

  /**
   * Apply AI suggestions to assign volunteers to teams.
   */
  applyAiSuggestions(icsId: number, suggestions: AiSuggestion[]): Observable<{ data: Ics }> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<{ data: Ics }>(
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
