import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Shipment } from './shipment.service';

export interface StaffDistribution {
  expected_quantity: number; loaded_quantity: number; remaining_quantity: number; is_fully_loaded: boolean;
  containers: { id: string; reference_number: string; status: string; transport_method: string | null; quantity: number }[];
}
export interface StaffShipmentDetail extends Shipment {
  actions: string[]; staff_statuses: string[]; scan_receive_allowed?: boolean;
  expected_quantity: number; loaded_quantity: number;
  distribution: StaffDistribution;
  delivery_readiness: { can_deliver: boolean; pending_containers: { reference_number: string; status: string }[] };
}

export interface AgencyStage { status: string; label: string; }
export interface StaffMember {
  id: string; job_title: string | null; statuses: string[]; active: boolean;
  accepted_at: string | null; invitation_expires_at: string | null;
  user: { id: number; uuid?: string; firstname: string; lastname: string; email: string };
}
export interface StaffEditor {
  firstname: string; lastname: string; email?: string; job_title: string; statuses: string[]; active: boolean;
}
export interface StaffInvitationResponse {
  message: string;
  data: { staff: StaffMember; invitation_url: string; email_queued: boolean };
}
export interface AgencyActivity { id: number; action: string; from_status: string | null; to_status: string | null; created_at: string; firstname: string; lastname: string; }
export interface TaskContainer { id: string; reference_number: string; status: string; transport_method: string | null; quantity?: number; }
export interface StaffTask {
  container_managed: boolean;
  id: string; title: string | null; tracking_number: string; external_tracking_number: string | null;
  status: string; transport_method: string | null; pickup_address: string; destination_address: string; agent_address: string | null;
  received_quantity: number | null; expected_quantity: number; loaded_quantity: number; quantity_adjusted: boolean; client_confirmed_at: string | null;
  customer: { firstname: string; lastname: string; phone: string | null } | null;
  products: { product_name?: string; name?: string; quantity?: number; qr_code_uuid?: string }[];
  containers: TaskContainer[]; actions: string[]; updated_at: string;
}
export interface TaskPage {
  can_manage_containers: boolean;
  transport_methods: ('sea' | 'air')[]; transport_method: 'sea' | 'air';
  agency_name: string; staff_name: string; job_title: string | null; stages: AgencyStage[]; assigned_stages: AgencyStage[]; counts: Record<string, number>;
  tasks: StaffTask[]; draft_containers: TaskContainer[];
  pagination: { current_page: number; last_page: number; total: number };
}
export interface StaffAction {
  action: string; expected_status: string; received_quantity?: number; additional_quantity?: number;
  quantity?: number; container_id?: string; status?: string;
}

@Injectable({ providedIn: 'root' })
export class AgencyService {
  private readonly api = inject(ApiService);
  team() { return this.api.get<{ data: { staff: StaffMember[]; stages: AgencyStage[]; activity: AgencyActivity[] } }>('agency/staff'); }
  invite(data: StaffEditor) { return this.api.post<StaffInvitationResponse>('agency/staff', data); }
  update(id: string, data: StaffEditor) { return this.api.put<{ message: string }>(`agency/staff/${id}`, data); }
  resend(id: string) { return this.api.post<StaffInvitationResponse>(`agency/staff/${id}/invitation`, {}); }
  invitation(id: string, token: string) {
    return this.api.get<{ data: { firstname: string; email: string; agency_name: string; job_title: string | null; stages: AgencyStage[] } }>(`staff/invitations/${encodeURIComponent(id)}`, { token });
  }
  accept(id: string, token: string, password: string, confirmation: string) {
    return this.api.post<{ message: string }>(`staff/invitations/${encodeURIComponent(id)}/accept`, { token, password, password_confirmation: confirmation });
  }
  tasks(page = 1, status = '', q = '', transportMethod: 'sea' | 'air' = 'sea') {
    const params = new URLSearchParams({ page: String(page), transport_method: transportMethod });
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    return this.api.get<{ data: TaskPage }>(`staff/tasks?${params}`);
  }
  task(id: string) { return this.api.get<{ success: boolean; data: { shipment: StaffShipmentDetail } }>(`staff/tasks/${encodeURIComponent(id)}`); }
  perform(id: string, action: StaffAction) { return this.api.post<{ message: string }>(`staff/tasks/${id}`, action); }
  changePassword(current_password: string, new_password: string, new_password_confirmation: string) {
    return this.api.post<{ message: string }>('change-password', { current_password, new_password, new_password_confirmation });
  }
}
