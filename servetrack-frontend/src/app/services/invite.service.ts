import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

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
  }
}
