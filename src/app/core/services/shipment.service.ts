import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface Shipment {
  id: string;
  user_id: string;
  agent_id: string;
  container_id?: string;
  tracking_number: string;
  external_tracking_number?: string;
  external_tracking_added_by?: string;
  title: string;
  description?: string;
  pickup_address: string;
  destination_address: string;
  agent_address?: string;
  estimated_price: number;
  actual_price?: number;
  status: 'pending_confirmation' | 'confirmed' | 'partially_received' | 'at_warehouse' | 'half_loaded' | 'loading_container' | 'loaded_in_container' | 'at_port_abroad' | 'in_transit' | 'at_tanzania_port' | 'at_tanzania_warehouse' | 'delivered' | 'cancelled';
  products?: any[];
  packages?: any[];
  notes?: string;
  confirmed_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  agent_delivered_at?: string;
  user_delivered_at?: string;
  received_quantity?: number;
  quantity_adjusted?: boolean;
  client_confirmed_at?: string;
  client_confirmed_by?: string;
  created_at: string;
  updated_at: string;
  user?: {
    uuid: string;
    firstname: string;
    lastname: string;
    email: string;
    phone?: string;
    country?: string;
  };
  agent?: {
    uuid: string;
    firstname: string;
    lastname: string;
    email: string;
    phone?: string;
  };
}

export interface BookShipmentRequest {
  agent_id: string;
  title: string;
  description?: string;
  pickup_address: string;
  destination_address: string;
  products?: any[];
  packages?: any[];
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ShipmentService {
  private readonly endpoint = 'shipments';
  
  // Signals for reactive state management
  public shipments = signal<Shipment[]>([]);
  public loading = signal<boolean>(false);
  public error = signal<string | null>(null);

  constructor(private apiService: ApiService) {}

  /**
   * Book a new shipment
   */
  bookShipment(request: BookShipmentRequest): Observable<{ success: boolean; message: string; data: { shipment: Shipment } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { shipment: Shipment } }>(
      `${this.endpoint}/book`, 
      request
    );
  }

  /**
   * Get user's shipments with pagination (default 10 per page)
   */
  getUserShipments(page: number = 1, perPage: number = 10): Observable<{ success: boolean; data: { shipments: Shipment[]; pagination?: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean } } }> {
    this.loading.set(true);
    this.error.set(null);

    const observable = this.apiService.get<{ success: boolean; data: { shipments: Shipment[]; pagination?: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean } } }>(`${this.endpoint}?page=${page}&per_page=${perPage}`, {});
    
    observable.subscribe({
      next: (response) => {
        if (response.success) {
          this.shipments.set(response.data.shipments);
        }
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error.message || 'Failed to fetch shipments');
        this.loading.set(false);
      }
    });

    return observable;
  }

  /**
   * Get user's shipments by status with pagination
   */
  getUserShipmentsByStatus(status: string, page: number = 1, perPage: number = 10): Observable<{ success: boolean; data: { shipments: Shipment[]; status: string; pagination?: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean } } }> {
    return this.apiService.get<{ success: boolean; data: { shipments: Shipment[]; status: string; pagination?: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean } } }>(`${this.endpoint}/status/${status}?page=${page}&per_page=${perPage}`, {});
  }

  /**
   * Get agent's shipments with pagination (default 10 per page)
   */
  getAgentShipments(page: number = 1, perPage: number = 10): Observable<{ success: boolean; data: { shipments: Shipment[]; pagination?: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean } } }> {
    return this.apiService.get<{ success: boolean; data: { shipments: Shipment[]; pagination?: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean } } }>(`${this.endpoint}/agent?page=${page}&per_page=${perPage}`, {});
  }

  /**
   * Get single shipment details
   */
  getShipment(id: string): Observable<{ success: boolean; data: { shipment: Shipment } }> {
    return this.apiService.get<{ success: boolean; data: { shipment: Shipment } }>(`${this.endpoint}/${id}`, {});
  }

  /**
   * Confirm shipment (for agents)
   */
  confirmShipment(id: string): Observable<{ success: boolean; message: string; data: { shipment: Shipment } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { shipment: Shipment } }>(
      `${this.endpoint}/${id}/confirm`, {}
    );
  }

  /**
   * Mark shipment as at warehouse (for agents)
   */
  markAsAtWarehouse(id: string): Observable<{ success: boolean; message: string; data: { shipment: Shipment } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { shipment: Shipment } }>(
      `${this.endpoint}/${id}/at-warehouse`, {}
    );
  }

  /**
   * Mark shipment as at port abroad (for agents)
   */
  markAsAtPortAbroad(id: string): Observable<{ success: boolean; message: string; data: { shipment: Shipment } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { shipment: Shipment } }>(
      `${this.endpoint}/${id}/at-port-abroad`, {}
    );
  }

  /**
   * Mark shipment as in transit (for agents)
   */
  markAsInTransit(id: string): Observable<{ success: boolean; message: string; data: { shipment: Shipment } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { shipment: Shipment } }>(
      `${this.endpoint}/${id}/in-transit`, {}
    );
  }

  /**
   * Mark shipment as delivered (for agents)
   */
  markAsDelivered(id: string): Observable<{ success: boolean; message: string; data: { shipment: Shipment } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { shipment: Shipment } }>(
      `${this.endpoint}/${id}/delivered`, {}
    );
  }

  /**
   * Get agent's shipments by status with pagination
   */
  getAgentShipmentsByStatus(status: string, page: number = 1, perPage: number = 10): Observable<{ success: boolean; data: { shipments: Shipment[]; status: string; pagination?: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean } } }> {
    return this.apiService.get<{ success: boolean; data: { shipments: Shipment[]; status: string; pagination?: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean } } }>(`${this.endpoint}/agent/${status}?page=${page}&per_page=${perPage}`, {});
  }

  /**
   * Get shipments by status
   */
  getShipmentsByStatus(status: Shipment['status']): Shipment[] {
    return this.shipments().filter(shipment => shipment.status === status);
  }

  /**
   * Get pending confirmation shipments
   */
  getPendingConfirmationShipments(): Shipment[] {
    return this.getShipmentsByStatus('pending_confirmation');
  }

  /**
   * Get confirmed shipments
   */
  getConfirmedShipments(): Shipment[] {
    return this.getShipmentsByStatus('confirmed');
  }

  /**
   * Get in transit shipments
   */
  getInTransitShipments(): Shipment[] {
    return this.getShipmentsByStatus('in_transit');
  }

  /**
   * Get delivered shipments
   */
  getDeliveredShipments(): Shipment[] {
    return this.getShipmentsByStatus('delivered');
  }

  /**
   * Reject shipment
   */
  rejectShipment(shipmentId: string): Observable<{ success: boolean; message: string; data: { shipment: Shipment } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { shipment: Shipment } }>(`${this.endpoint}/${shipmentId}/reject`, {});
  }

  /**
   * Cancel shipment
   */
  cancelShipment(shipmentId: string): Observable<{ success: boolean; message: string; data: { shipment: Shipment } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { shipment: Shipment } }>(`${this.endpoint}/${shipmentId}/cancel`, {});
  }

  /**
   * Update shipment external tracking number (for both agents and customers)
   */
  updateTrackingNumber(shipmentId: string, trackingNumber: string): Observable<{ success: boolean; message: string; data: { shipment: Shipment } }> {
    return this.apiService.put<{ success: boolean; message: string; data: { shipment: Shipment } }>(
      `${this.endpoint}/${shipmentId}/tracking-number`,
      { external_tracking_number: trackingNumber }
    );
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.error.set(null);
  }

  /**
   * Approve shipment by QR code scan (for agents)
   */
  approveByQrCode(qrCodeUuid: string, receivedQuantity?: number, preview?: boolean): Observable<{ success: boolean; info?: boolean; preview?: boolean; message: string; data?: { shipment: Shipment } }> {
    const payload: any = { qr_code_uuid: qrCodeUuid };
    if (receivedQuantity !== undefined && receivedQuantity !== null) {
      payload.received_quantity = receivedQuantity;
    }
    if (preview) {
      payload.preview = true;
    }
    return this.apiService.post<{ success: boolean; info?: boolean; preview?: boolean; message: string; data?: { shipment: Shipment } }>(
      `${this.endpoint}/scan-approve`,
      payload
    );
  }

  /**
   * Get container loading status for a shipment
   */
  getContainerStatus(shipmentId: string): Observable<{ success: boolean; data: { expected_quantity: number; loaded_quantity: number; remaining_quantity: number; is_fully_loaded: boolean; containers: { reference_number: string; quantity: number }[] } }> {
    return this.apiService.get<{ success: boolean; data: { expected_quantity: number; loaded_quantity: number; remaining_quantity: number; is_fully_loaded: boolean; containers: { reference_number: string; quantity: number }[] } }>(
      `${this.endpoint}/${shipmentId}/container-status`,
      {}
    );
  }

  /**
   * Check if a shipment is ready for delivery (all containers at Tanzania warehouse)
   */
  getDeliveryReadiness(shipmentId: string): Observable<{ success: boolean; data: { can_deliver: boolean; reason: string; pending_containers: { reference_number: string; status: string }[] } }> {
    return this.apiService.get<{ success: boolean; data: { can_deliver: boolean; reason: string; pending_containers: { reference_number: string; status: string }[] } }>(
      `${this.endpoint}/${shipmentId}/delivery-readiness`,
      {}
    );
  }

  /**
   * Client confirms they accept the partial received quantity
   */
  confirmPartialQuantity(shipmentId: string): Observable<{ success: boolean; message: string; data?: { shipment: Shipment } }> {
    return this.apiService.post<{ success: boolean; message: string; data?: { shipment: Shipment } }>(
      `${this.endpoint}/${shipmentId}/confirm-partial-quantity`,
      {}
    );
  }

  /**
   * Agent adds additional received quantity to a partially received shipment
   */
  addReceivedQuantity(shipmentId: string, additionalQuantity: number): Observable<{ success: boolean; fully_received?: boolean; partial_receipt?: boolean; message: string; data?: { shipment: Shipment; expected_quantity?: number; received_quantity?: number; remaining_quantity?: number } }> {
    return this.apiService.post<{ success: boolean; fully_received?: boolean; partial_receipt?: boolean; message: string; data?: { shipment: Shipment; expected_quantity?: number; received_quantity?: number; remaining_quantity?: number } }>(
      `${this.endpoint}/${shipmentId}/add-received-quantity`,
      { additional_quantity: additionalQuantity }
    );
  }

  /**
   * Mark shipment as delivered by user QR scan confirmation
   */
  markAsUserDelivered(shipmentId: string, qrCodeUuid?: string): Observable<{ success: boolean; info?: boolean; message: string; data?: { shipment: Shipment } }> {
    return this.apiService.post<{ success: boolean; info?: boolean; message: string; data?: { shipment: Shipment } }>(
      `${this.endpoint}/${shipmentId}/confirm-delivery`,
      qrCodeUuid ? { qr_code_uuid: qrCodeUuid } : {}
    );
  }

  /**
   * Refresh shipments data
   */
  refreshShipments(): void {
    this.getUserShipments().subscribe();
  }
}
