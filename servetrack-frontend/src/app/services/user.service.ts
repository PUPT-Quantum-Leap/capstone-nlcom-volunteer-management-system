import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../models/user';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  getUsers(search?: string, role?: string): Observable<ApiResponse<User[]>> {
    let params: any = {};
    if (search) params.search = search;
    if (role) params.role = role;

    return this.http.get<ApiResponse<User[]>>(this.baseUrl, {
      withCredentials: true,
      params,
    });
  }

  getUser(id: number): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.baseUrl}/${id}`, {
      withCredentials: true,
    });
  }

  createUser(data: Partial<User> & { password?: string }): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(this.baseUrl, data, {
      withCredentials: true,
    });
  }

  updateUser(id: number, data: Partial<User>): Observable<ApiResponse<User>> {
    return this.http.put<ApiResponse<User>>(`${this.baseUrl}/${id}`, data, {
      withCredentials: true,
    });
  }

  deleteUser(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`, {
      withCredentials: true,
    });
  }

  softDeleteUser(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${id}/soft-delete`, {}, {
      withCredentials: true,
    });
  }

  restoreUser(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${id}/restore`, {}, {
      withCredentials: true,
    });
  }

  resetPassword(id: number, password: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/${id}/reset-password`, { password }, {
      withCredentials: true,
    });
  }
}
