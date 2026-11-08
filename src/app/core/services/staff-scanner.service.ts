import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { AgencyService, StaffAction, StaffDistribution, StaffShipmentDetail } from './agency.service';
import { Container } from './container.service';
import { StaffContainerService } from './staff-container.service';

@Injectable()
export class StaffScannerService {
  private readonly api = inject(ApiService);
  private readonly agency = inject(AgencyService);
  private readonly containers = inject(StaffContainerService);
  private readonly snapshots = new Map<string, StaffShipmentDetail>();
  private readonly qrShipments = new Map<string, string>();
  private context = '';

  canReach(status: string): boolean { return !!this.snapshots.get(this.context)?.staff_statuses.includes(status); }

  approveByQrCode(uuid: string, quantity?: number, preview?: boolean) {
    if (preview) this.context = '';
    const id = this.qrShipments.get(uuid);
    return this.api.post<{ success: boolean; preview?: boolean; partial_receipt?: boolean; message: string; data: { shipment: StaffShipmentDetail } }>('staff/scan-approve', {
      qr_code_uuid: uuid, ...(preview ? { preview: true } : { received_quantity: quantity, expected_status: id ? this.snapshots.get(id)?.status : undefined }),
    }).pipe(tap(response => {
      if (response.data?.shipment) {
        this.remember(response.data.shipment);
        this.context = response.data.shipment.id;
        this.qrShipments.set(uuid, this.context);
      }
    }));
  }

  getContainerStatus(id: string) {
    return this.api.get<{ success: boolean; data: StaffDistribution }>(`staff/tasks/${encodeURIComponent(id)}/container-status`);
  }

  addReceivedQuantity(id: string, quantity: number) {
    return this.perform(id, { action: 'add_received', additional_quantity: quantity });
  }

  confirmBooking(id: string) { return this.perform(id, { action: 'confirm' }); }

  getContainers(_transportMethod?: string | null) {
    return this.api.get<{ success: boolean; data: { containers: Container[] } }>('staff/scan-containers', { shipment_id: this.context });
  }

  getContainer(id: string) {
    return this.containers.getContainer(id)
      .pipe(tap(response => (response.data.container.shipments || []).forEach(shipment => this.remember(shipment))));
  }

  addShipment(containerId: string, shipmentId: string, quantity?: number) {
    return this.perform(shipmentId, { action: 'load', container_id: containerId, quantity });
  }

  closeContainer(id: string) {
    return this.containers.closeContainer(id);
  }

  updateContainerStatus(id: string, status: string) {
    return this.containers.updateContainerStatus(id, status);
  }

  createContainer(reference: string, transportMethod?: string | null) {
    return this.containers.createContainer(reference, transportMethod);
  }

  private perform(id: string, action: Omit<StaffAction, 'expected_status'>): Observable<{ success: boolean; message: string; data: { shipment: StaffShipmentDetail } }> {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) return throwError(() => ({ status: 409, error: { message: 'Scan the parcel again before continuing.' } }));
    return this.agency.perform(id, { ...action, expected_status: snapshot.status }).pipe(
      switchMap(result => this.agency.task(id).pipe(map(response => ({ success: true, message: result.message, data: response.data })))),
      tap(response => this.remember(response.data.shipment)),
    );
  }

  private remember(shipment: StaffShipmentDetail): void { this.snapshots.set(shipment.id, shipment); }
}
