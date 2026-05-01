import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
<<<<<<< deleon-jasmine
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
=======
import { Observable } from 'rxjs';
>>>>>>> main

export interface Invite {
  id: number;
  email: string | null;
  token: string;
  role: string;
  expires_at: string | null;
  accepted_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface InviteResponse {
  success: boolean;
  message: string;
  data: {
    invite: Invite;
    invite_link: string;
<<<<<<< deleon-jasmine
    email_sent?: boolean;
=======
>>>>>>> main
  };
}

export interface InviteValidationResponse {
  success: boolean;
  message: string;
  data?: {
    email: string | null;
    role: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class InviteService {
<<<<<<< deleon-jasmine
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = this.apiUrl.replace('/api', '');

  constructor(private readonly http: HttpClient) {}

  /**
   * Fetch CSRF cookie before making stateful requests
   */
  private ensureCsrf$(): Observable<void> {
    return this.http.get<void>(`${this.baseUrl}/sanctum/csrf-cookie`, { withCredentials: true });
  }

  createInvite(email: string | null, role: string, sendEmail = true): Observable<InviteResponse> {
    return this.ensureCsrf$().pipe(
      switchMap(() =>
        this.http.post<InviteResponse>(
          `${this.apiUrl}/invites`,
          { email, role, send_email: sendEmail },
          { withCredentials: true }
        )
      )
    );
  }

  validateInvite(token: string): Observable<InviteValidationResponse> {
    return this.http.post<InviteValidationResponse>(
      `${this.apiUrl}/invites/validate`,
      { token },
      { withCredentials: true }
    );
  }

  getInvites(): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(
      `${this.apiUrl}/invites`,
      { withCredentials: true }
    );
  }

  deleteInvite(id: number): Observable<{ success: boolean; message: string }> {
    return this.ensureCsrf$().pipe(
      switchMap(() =>
        this.http.delete<{ success: boolean; message: string }>(
          `${this.apiUrl}/invites/${id}`,
          { withCredentials: true }
        )
      )
    );
=======
  private readonly apiUrl = 'http://localhost:8000/api';

  constructor(private readonly http: HttpClient) {}

  createInvite(email: string | null, role: string): Observable<InviteResponse> {
    return this.http.post<InviteResponse>(`${this.apiUrl}/invites`, { email, role });
  }

  validateInvite(token: string): Observable<InviteValidationResponse> {
    return this.http.post<InviteValidationResponse>(`${this.apiUrl}/invites/validate`, { token });
  }

  getInvites(): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/invites`);
  }

  deleteInvite(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/invites/${id}`);
>>>>>>> main
  }
}
