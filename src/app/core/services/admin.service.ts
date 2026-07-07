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
    shipments: number;
    containers: number;
    addresses: number;
    reviews: number;
    payments: number;
    revenue: number;
  };
  today: {
    new_users: number;
    new_packages: number;
    new_messages: number;
    new_shipments: number;
    new_payments: number;
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

  private toQuery(params?: Record<string, any>): Record<string, string> {
    const query: Record<string, string> = {};
    if (!params) return query;
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query[key] = String(value);
      }
    }
    return query;
  }

  // Dashboard
  getDashboardStats(): Observable<DashboardStats> {
    return this.api.get<{ data: DashboardStats }>('admin/dashboard/stats').pipe(
      map(res => res.data)
    );
  }

  // Users
  getUsers(params?: { page?: number; per_page?: number; role?: string; search?: string; verified?: boolean }): Observable<PaginatedResponse<User>> {
    return this.api.get<{ data: PaginatedResponse<User> }>('admin/users', this.toQuery(params)).pipe(map(res => res.data));
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

  bulkDeleteUsers(ids: number[]): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('admin/users/bulk-delete', { ids });
  }

  bulkUpdateUserRole(ids: number[], role: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('admin/users/bulk-update-role', { ids, role });
  }

  // Agents
  getAgents(params?: { page?: number; per_page?: number; search?: string; verified?: boolean; pending?: boolean }): Observable<PaginatedResponse<Agent>> {
    return this.api.get<{ data: PaginatedResponse<Agent> }>('admin/agents', this.toQuery(params)).pipe(map(res => res.data));
  }

  getAgentProfile(id: number): Observable<{ data: Agent }> {
    return this.api.get<{ data: Agent }>(`admin/agents/${id}/profile`);
  }

  updateAgentProfile(id: number, data: any): Observable<{ message: string; data: Agent }> {
    return this.api.put<{ message: string; data: Agent }>(`admin/agents/${id}/profile`, data);
  }

  verifyAgent(id: number): Observable<{ message: string; data: Agent }> {
    return this.api.post<{ message: string; data: Agent }>(`admin/agents/${id}/verify`, {});
  }

  rejectAgent(id: number): Observable<{ message: string; data: Agent }> {
    return this.api.post<{ message: string; data: Agent }>(`admin/agents/${id}/reject`, {});
  }

  getPendingVerifications(params?: { page?: number; per_page?: number }): Observable<PaginatedResponse<Agent>> {
    return this.api.get<{ data: PaginatedResponse<Agent> }>('admin/agents/pending-verifications', this.toQuery(params)).pipe(map(res => res.data));
  }

  // Shipments (real shipment records)
  getShipments(params?: { page?: number; per_page?: number; search?: string; status?: string }): Observable<any> {
    return this.api.get<{ data: any }>('admin/shipments', this.toQuery(params)).pipe(map(res => res.data));
  }

  getShipment(id: string): Observable<any> {
    return this.api.get<{ data: any }>(`admin/shipments/${id}`).pipe(map(res => res.data));
  }

  updateShipment(id: string, data: any): Observable<{ message: string; data: any }> {
    return this.api.put<{ message: string; data: any }>(`admin/shipments/${id}`, data);
  }

  updateShipmentStatus(id: string, status: string): Observable<{ message: string; data: any }> {
    return this.api.post<{ message: string; data: any }>(`admin/shipments/${id}/status`, { status });
  }

  deleteShipment(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/shipments/${id}`);
  }

  bulkUpdateShipmentStatus(ids: string[], status: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('admin/shipments/bulk-update-status', { ids, status });
  }

  // Packages (previously mislabeled as shipments)
  getPackages(params?: { page?: number; per_page?: number; search?: string }): Observable<any> {
    return this.api.get<{ data: any }>('admin/packages', this.toQuery(params)).pipe(map(res => res.data));
  }

  getPackage(uuid: string): Observable<any> {
    return this.api.get<{ data: any }>(`admin/packages/${uuid}`).pipe(map(res => res.data));
  }

  updatePackage(uuid: string, data: any): Observable<{ message: string; data: any }> {
    return this.api.put<{ message: string; data: any }>(`admin/packages/${uuid}`, data);
  }

  deletePackage(uuid: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/packages/${uuid}`);
  }

  // Containers
  getContainers(params?: { page?: number; per_page?: number; search?: string; status?: string; agent_id?: string }): Observable<any> {
    return this.api.get<{ data: any }>('admin/containers', this.toQuery(params)).pipe(map(res => res.data));
  }

  getContainer(id: string): Observable<any> {
    return this.api.get<{ data: any }>(`admin/containers/${id}`).pipe(map(res => res.data));
  }

  updateContainerStatus(id: string, status: string): Observable<{ message: string; data: any }> {
    return this.api.post<{ message: string; data: any }>(`admin/containers/${id}/status`, { status });
  }

  addShipmentToContainer(id: string, shipmentId: string, quantity: number): Observable<{ message: string; data: any }> {
    return this.api.post<{ message: string; data: any }>(`admin/containers/${id}/add-shipment`, { shipment_id: shipmentId, quantity });
  }

  removeShipmentFromContainer(id: string, shipmentId: string): Observable<{ message: string; data: any }> {
    return this.api.post<{ message: string; data: any }>(`admin/containers/${id}/remove-shipment`, { shipment_id: shipmentId });
  }

  closeContainer(id: string): Observable<{ message: string; data: any }> {
    return this.api.post<{ message: string; data: any }>(`admin/containers/${id}/close`, {});
  }

  deleteContainer(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/containers/${id}`);
  }

  bulkUpdateContainerStatus(ids: string[], status: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('admin/containers/bulk-update-status', { ids, status });
  }

  // Addresses
  getAddresses(params?: { page?: number; per_page?: number; search?: string; user_id?: number }): Observable<any> {
    return this.api.get<{ data: any }>('admin/addresses', this.toQuery(params)).pipe(map(res => res.data));
  }

  getAddress(id: number): Observable<any> {
    return this.api.get<{ data: any }>(`admin/addresses/${id}`).pipe(map(res => res.data));
  }

  updateAddress(id: number, data: any): Observable<{ message: string; data: any }> {
    return this.api.put<{ message: string; data: any }>(`admin/addresses/${id}`, data);
  }

  deleteAddress(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/addresses/${id}`);
  }

  setDefaultAddress(id: number): Observable<{ message: string; data: any }> {
    return this.api.post<{ message: string; data: any }>(`admin/addresses/${id}/set-default`, {});
  }

  // QR Codes
  getQrCodes(params?: { page?: number; per_page?: number; search?: string }): Observable<any> {
    return this.api.get<{ data: any }>('admin/qr-codes', this.toQuery(params)).pipe(map(res => res.data));
  }

  getQrCode(uuid: string): Observable<any> {
    return this.api.get<{ data: any }>(`admin/qr-codes/${uuid}`).pipe(map(res => res.data));
  }

  updateQrCode(uuid: string, data: any): Observable<{ message: string; data: any }> {
    return this.api.put<{ message: string; data: any }>(`admin/qr-codes/${uuid}`, data);
  }

  deleteQrCode(uuid: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/qr-codes/${uuid}`);
  }

  // Reviews
  getReviews(params?: { page?: number; per_page?: number; search?: string; status?: string }): Observable<any> {
    return this.api.get<{ data: any }>('admin/reviews', this.toQuery(params)).pipe(map(res => res.data));
  }

  getReview(id: number): Observable<any> {
    return this.api.get<{ data: any }>(`admin/reviews/${id}`).pipe(map(res => res.data));
  }

  updateReviewStatus(id: number, status: string, adminNote?: string): Observable<{ message: string; data: any }> {
    return this.api.put<{ message: string; data: any }>(`admin/reviews/${id}/status`, { status, admin_note: adminNote });
  }

  deleteReview(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/reviews/${id}`);
  }

  bulkUpdateReviewStatus(ids: number[], status: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('admin/reviews/bulk-update-status', { ids, status });
  }

  // Payments
  getPayments(params?: { page?: number; per_page?: number; search?: string; status?: string }): Observable<any> {
    return this.api.get<{ data: any }>('admin/payments', this.toQuery(params)).pipe(map(res => res.data));
  }

  getPayment(id: number): Observable<any> {
    return this.api.get<{ data: any }>(`admin/payments/${id}`).pipe(map(res => res.data));
  }

  createPayment(data: any): Observable<{ message: string; data: any }> {
    return this.api.post<{ message: string; data: any }>('admin/payments', data);
  }

  updatePayment(id: number, data: any): Observable<{ message: string; data: any }> {
    return this.api.put<{ message: string; data: any }>(`admin/payments/${id}`, data);
  }

  deletePayment(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/payments/${id}`);
  }

  // Email Verifications
  getEmailVerifications(params?: { page?: number; per_page?: number; search?: string; used?: boolean }): Observable<any> {
    return this.api.get<{ data: any }>('admin/email-verifications', this.toQuery(params)).pipe(map(res => res.data));
  }

  resendEmailVerification(id: number): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`admin/email-verifications/${id}/resend`, {});
  }

  verifyEmailManual(id: number): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`admin/email-verifications/${id}/verify-manual`, {});
  }

  // Password Reset Tokens
  getPasswordResetTokens(params?: { page?: number; per_page?: number; search?: string; used?: boolean }): Observable<any> {
    return this.api.get<{ data: any }>('admin/password-reset-tokens', this.toQuery(params)).pipe(map(res => res.data));
  }

  deletePasswordResetToken(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`admin/password-reset-tokens/${id}`);
  }

  // User Keys
  getUserKeys(params?: { page?: number; per_page?: number; search?: string }): Observable<any> {
    return this.api.get<{ data: any }>('admin/user-keys', this.toQuery(params)).pipe(map(res => res.data));
  }

  getUserKey(id: number): Observable<any> {
    return this.api.get<{ data: any }>(`admin/user-keys/${id}`).pipe(map(res => res.data));
  }

  // Messages
  getMessages(params?: { page?: number; per_page?: number; search?: string }): Observable<any> {
    return this.api.get<{ data: any }>('admin/messages', this.toQuery(params)).pipe(map(res => res.data));
  }

  // Logs
  getLogs(params?: { page?: number; per_page?: number; search?: string }): Observable<any> {
    return this.api.get<{ data: any }>('admin/logs', this.toQuery(params)).pipe(map(res => res.data));
  }

  // Settings
  getSettings(): Observable<{ success: boolean; data: any }> {
    return this.api.get<{ success: boolean; data: any }>('admin/settings');
  }

  updateSettings(payload: { settings: any }): Observable<{ success: boolean; message: string; data: any }> {
    return this.api.put<{ success: boolean; message: string; data: any }>('admin/settings', payload);
  }
}
