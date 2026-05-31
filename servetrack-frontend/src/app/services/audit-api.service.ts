import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuditLog {
  id: number;
  user_id: number | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  description: string | null;
  status: 'success' | 'failure' | 'error';
  severity: 'info' | 'warning' | 'error' | 'critical';
  resource_type: string | null;
  resource_id: string | null;
  resource_label: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  source: string;
  ip_address: string | null;
  user_agent: string | null;
  reason: string | null;
  checksum: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  category?: string;
  action?: string;
  severity?: string;
  status?: string;
  source?: string;
  user_id?: number;
  resource_type?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export interface AuditStats {
  total_today: number;
  total_all: number;
  failures_today: number;
  critical_today: number;
  categories: Record<string, number>;
}

export interface AuditActionItem {
  value: string;
  label: string;
  category: string;
  severity: string;
}

export interface AuditLogListResponse {
  success: boolean;
  data: AuditLog[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface AuditApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class AuditApiService {
  private http = inject(HttpClient);
  private readonly hiddenPath = `${environment.apiUrl}/_audit`;

  getAuditLogs(filters: AuditLogFilters = {}): Observable<AuditLogListResponse> {
    let params = new HttpParams();

    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.per_page) params = params.set('per_page', filters.per_page.toString());
    if (filters.category) params = params.set('category', filters.category);
    if (filters.action) params = params.set('action', filters.action);
    if (filters.severity) params = params.set('severity', filters.severity);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.source) params = params.set('source', filters.source);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.user_id) params = params.set('user_id', filters.user_id.toString());
    if (filters.resource_type) params = params.set('resource_type', filters.resource_type);

    return this.http.get<AuditLogListResponse>(this.hiddenPath, { params, withCredentials: true }).pipe(
      catchError(() => of({
        success: false,
        data: [],
        pagination: { current_page: 1, last_page: 1, per_page: filters.per_page ?? 10, total: 0 },
      }))
    );
  }

  getAuditStats(): Observable<AuditApiResponse<AuditStats>> {
    return this.http.get<AuditApiResponse<AuditStats>>(`${this.hiddenPath}/stats`, { withCredentials: true }).pipe(
      catchError(() => of({
        success: false,
        data: { total_today: 0, total_all: 0, failures_today: 0, critical_today: 0, categories: {} },
      }))
    );
  }

  getAuditActions(): Observable<AuditApiResponse<AuditActionItem[]>> {
    return this.http.get<AuditApiResponse<AuditActionItem[]>>(`${this.hiddenPath}/actions`, { withCredentials: true }).pipe(
      catchError(() => of({ success: false, data: [] }))
    );
  }

  exportAuditLogs(filters: AuditLogFilters = {}): Observable<Blob> {
    let params = new HttpParams();

    if (filters.category) params = params.set('category', filters.category);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);

    return this.http.get(`${this.hiddenPath}/export`, {
      params,
      withCredentials: true,
      responseType: 'blob',
    }).pipe(
      catchError(() => { throw new Error('Failed to export audit logs'); })
    );
  }
}
