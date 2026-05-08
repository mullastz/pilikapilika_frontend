import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { Agent, User } from '../interfaces/auth.interface';

export interface DashboardStats {
  totals: {
    users: number;
    buyers: number;
    sellers: number;
    admins: number;
    owners: number;
    verified_agents: number;
    pending_verifications: number;
    packages: number;
    qr_codes: number;
    regions: number;
    districts: number;
    messages: number;
  };
  today: {
    new_users: number;
    new_packages: number;
    new_messages: number;
  };
  charts: {
    signups_last_7_days: { date: string; count: number }[];
    users_by_role: { role: string; count: number }[];
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private api: ApiService) {}

  // Dashboard
  getDashboardStats(): Observable<DashboardStats> {
    return this.api.get<{ data: DashboardStats }>('admin/dashboard/stats').pipe(
      map(res => res.data)
    );
  }

  // Users
  getUsers(params?: { page?: number; per_page?: number; role?: string; search?: string; verified?: boolean }): Observable<PaginatedResponse<User>> {
    const query: Record<string, string> = {};
    if (params?.page) query['page'] = params.page.toString();
    if (params?.per_page) query['per_page'] = params.per_page.toString();
    if (params?.role) query['role'] = params.role;
    if (params?.search) query['search'] = params.search;
    if (params?.verified) query['verified'] = '1';
    return this.api.get<{ data: PaginatedResponse<User> }>('admin/users', query).pipe(map(res => res.data));
  }

  getUser(id: number): Observable<User> {
    return this.api.get<{ data: User }>(`admin/users/${id}`).pipe(map(res => res.data));
  }

  updateUser(id: number, data: Partial<User>): Observable<{ message: string; data: User }> {
    return this.api.put<{ message: string; data: User }>(`admin/users/${id}`, data);
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/users/${id}`);
  }

  // Agents
  getAgents(params?: { page?: number; per_page?: number; search?: string; verified?: boolean; pending?: boolean }): Observable<PaginatedResponse<Agent>> {
    const query: Record<string, string> = {};
    if (params?.page) query['page'] = params.page.toString();
    if (params?.per_page) query['per_page'] = params.per_page.toString();
    if (params?.search) query['search'] = params.search;
    if (params?.verified) query['verified'] = '1';
    if (params?.pending) query['pending'] = '1';
    return this.api.get<{ data: PaginatedResponse<Agent> }>('admin/agents', query).pipe(map(res => res.data));
  }

  // Shipments / Packages
  getShipments(params?: { page?: number; per_page?: number; search?: string }): Observable<any> {
    const query: Record<string, string> = {};
    if (params?.page) query['page'] = params.page.toString();
    if (params?.per_page) query['per_page'] = params.per_page.toString();
    if (params?.search) query['search'] = params.search;
    return this.api.get<{ data: any }>('admin/shipments', query).pipe(map(res => res.data));
  }

  updateShipment(uuid: string, data: any): Observable<{ message: string; data: any }> {
    return this.api.put<{ message: string; data: any }>(`admin/shipments/${uuid}`, data);
  }

  deleteShipment(uuid: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/shipments/${uuid}`);
  }

  // QR Codes
  getQrCodes(params?: { page?: number; per_page?: number; search?: string }): Observable<any> {
    const query: Record<string, string> = {};
    if (params?.page) query['page'] = params.page.toString();
    if (params?.per_page) query['per_page'] = params.per_page.toString();
    if (params?.search) query['search'] = params.search;
    return this.api.get<{ data: any }>('admin/qr-codes', query).pipe(map(res => res.data));
  }

  updateQrCode(uuid: string, data: any): Observable<{ message: string; data: any }> {
    return this.api.put<{ message: string; data: any }>(`admin/qr-codes/${uuid}`, data);
  }

  deleteQrCode(uuid: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/qr-codes/${uuid}`);
  }

  // Messages
  getMessages(params?: { page?: number; per_page?: number; search?: string }): Observable<any> {
    const query: Record<string, string> = {};
    if (params?.page) query['page'] = params.page.toString();
    if (params?.per_page) query['per_page'] = params.per_page.toString();
    if (params?.search) query['search'] = params.search;
    return this.api.get<{ data: any }>('admin/messages', query).pipe(map(res => res.data));
  }

  // Logs
  getLogs(params?: { page?: number; per_page?: number; search?: string }): Observable<any> {
    const query: Record<string, string> = {};
    if (params?.page) query['page'] = params.page.toString();
    if (params?.per_page) query['per_page'] = params.per_page.toString();
    if (params?.search) query['search'] = params.search;
    return this.api.get<{ data: any }>('admin/logs', query).pipe(map(res => res.data));
  }

  // Settings
  getSettings(): Observable<{ success: boolean; data: any }> {
    return this.api.get<{ success: boolean; data: any }>('admin/settings');
  }

  updateSettings(payload: { settings: any }): Observable<{ success: boolean; message: string; data: any }> {
    return this.api.put<{ success: boolean; message: string; data: any }>('admin/settings', payload);
  }
}
