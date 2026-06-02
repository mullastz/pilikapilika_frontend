import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface Container {
  id: string;
  agent_id: string;
  reference_number: string;
  status: 'draft' | 'closed' | 'in_transit' | 'at_tanzania_port' | 'at_tanzania_warehouse';
  closed_at?: string;
  in_transit_at?: string;
  at_tanzania_port_at?: string;
  at_tanzania_warehouse_at?: string;
  created_at: string;
  updated_at: string;
  shipments_count?: number;
  shipments?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ContainerService {
  private readonly endpoint = 'containers';

  constructor(private apiService: ApiService) {}

  getContainers(): Observable<{ success: boolean; data: { containers: Container[] } }> {
    return this.apiService.get<{ success: boolean; data: { containers: Container[] } }>(this.endpoint, {});
  }

  createContainer(referenceNumber: string): Observable<{ success: boolean; message: string; data: { container: Container } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { container: Container } }>(
      this.endpoint,
      { reference_number: referenceNumber }
    );
  }

  getContainer(id: string): Observable<{ success: boolean; data: { container: Container } }> {
    return this.apiService.get<{ success: boolean; data: { container: Container } }>(`${this.endpoint}/${id}`, {});
  }

  addShipment(containerId: string, shipmentId: string, quantity?: number): Observable<{ success: boolean; message: string; data: any }> {
    const payload: any = { shipment_id: shipmentId };
    if (quantity !== undefined && quantity !== null) {
      payload.quantity = quantity;
    }
    return this.apiService.post<{ success: boolean; message: string; data: any }>(
      `${this.endpoint}/${containerId}/add-shipment`,
      payload
    );
  }

  removeShipment(containerId: string, shipmentId: string): Observable<{ success: boolean; message: string; data: any }> {
    return this.apiService.post<{ success: boolean; message: string; data: any }>(
      `${this.endpoint}/${containerId}/remove-shipment`,
      { shipment_id: shipmentId }
    );
  }

  returnShipmentToWarehouse(containerId: string, shipmentId: string): Observable<{ success: boolean; message: string; data: any }> {
    return this.apiService.post<{ success: boolean; message: string; data: any }>(
      `${this.endpoint}/${containerId}/return-to-warehouse`,
      { shipment_id: shipmentId }
    );
  }

  scanShipment(containerId: string, qrCodeUuid: string, quantity?: number): Observable<{ success: boolean; info?: boolean; message: string; data: any }> {
    const payload: any = { container_id: containerId, qr_code_uuid: qrCodeUuid };
    if (quantity !== undefined && quantity !== null) {
      payload.quantity = quantity;
    }
    return this.apiService.post<{ success: boolean; info?: boolean; message: string; data: any }>(
      `${this.endpoint}/scan-shipment`,
      payload
    );
  }

  closeContainer(containerId: string): Observable<{ success: boolean; message: string; data: { container: Container } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { container: Container } }>(
      `${this.endpoint}/${containerId}/close`,
      {}
    );
  }

  updateContainerStatus(containerId: string, status: string): Observable<{ success: boolean; message: string; data: { container: Container } }> {
    return this.apiService.post<{ success: boolean; message: string; data: { container: Container } }>(
      `${this.endpoint}/${containerId}/status`,
      { status }
    );
  }
}
