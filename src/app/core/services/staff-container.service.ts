import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { Container } from './container.service';

export interface StaffContainerList {
  success: boolean;
  data: { containers: Container[]; can_create: boolean; can_browse: boolean; transport_methods: ('sea' | 'air')[]; transport_method: 'sea' | 'air' };
}

@Injectable({ providedIn: 'root' })
export class StaffContainerService {
  private readonly api = inject(ApiService);
  private readonly versions = new Map<string, Container['status']>();
  readonly canCreate = signal(false);
  readonly canBrowse = signal(false);

  getContainers(transportMethod?: string | null, activeOnly = false, metadataOnly = false, shipmentId?: string | null) {
    return this.api.get<StaffContainerList>('staff/containers', {
      ...(transportMethod ? { transport_method: transportMethod } : {}),
      ...(activeOnly ? { active_only: '1' } : {}), ...(metadataOnly ? { metadata_only: '1' } : {}),
      ...(shipmentId ? { shipment_id: shipmentId } : {}),
    }).pipe(tap(response => {
      this.canCreate.set(response.data.can_create);
      this.canBrowse.set(response.data.can_browse);
      response.data.containers.forEach(container => this.remember(container));
    }));
  }

  getContainer(id: string) {
    return this.api.get<{ success: boolean; data: { container: Container } }>(`staff/containers/${encodeURIComponent(id)}`)
      .pipe(tap(response => this.remember(response.data.container)));
  }

  createContainer(reference: string, transportMethod?: string | null) {
    return this.api.post<{ success: boolean; message: string; data: { container: Container } }>('staff/containers', {
      reference_number: reference.trim(), transport_method: transportMethod || 'sea',
    }).pipe(tap(response => this.remember(response.data.container)));
  }

  closeContainer(id: string) { return this.operate(id, 'close'); }
  updateContainerStatus(id: string, status: string) { return this.operate(id, 'advance', status); }

  private operate(id: string, action: string, status?: string): Observable<{ success: boolean; message: string; data: { container: Container } }> {
    const expected = this.versions.get(id);
    if (!expected) return throwError(() => ({ status: 409, error: { message: 'Open the container again before updating it.' } }));
    return this.api.post<{ success: boolean; message: string; data: { container: Container } }>(`staff/containers/${encodeURIComponent(id)}`, {
      action, expected_status: expected, ...(status ? { status } : {}),
    }).pipe(tap(response => this.remember(response.data.container)));
  }

  private remember(container: Container): void { this.versions.set(container.id, container.status); }
}
