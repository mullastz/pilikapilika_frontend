import { Component, DestroyRef, Input, OnChanges, OnInit, SimpleChanges, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { Container } from '../../../core/services/container.service';
import { StaffContainerService } from '../../../core/services/staff-container.service';
import { StaffShipmentDetail } from '../../../core/services/agency.service';
import { ToastService } from '../../../core/services/toast.service';
import { getShipmentStageLabel } from '../../../core/helpers/shipment-progress.helper';

@Component({
  selector: 'app-staff-containers', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './staff-containers.html', styleUrl: '../../../feature/shipping/shipping.css',
})
export class StaffContainers implements OnInit, OnChanges {
  private readonly api = inject(StaffContainerService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private listRequest?: Subscription;
  private detailRequest?: Subscription;
  @Input() transportMethod: 'sea' | 'air' = 'sea';
  @Input() embedded = false;
  @Input() shipmentId: string | null = null;
  readonly filterCleared = output<void>();
  readonly closed = output<void>();
  readonly updated = output<void>();
  readonly viewShipment = output<string>();
  readonly scanRequested = output<Container>();
  @Input() useScannerHere = false;
  readonly mode = signal<'sea' | 'air'>('sea');
  readonly methods = signal<('sea' | 'air')[]>([]);
  readonly canCreate = this.api.canCreate;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly items = signal<Container[]>([]);
  readonly selected = signal<Container | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly creating = signal(false);
  readonly updating = signal(false);
  readonly confirmation = signal<{ container: Container; next?: string } | null>(null);
  readonly closing = signal(false);
  readonly term = computed(() => this.mode() === 'air' ? 'Batch' : 'Container');
  readonly filtered = computed(() => {
    const order = ['draft', 'closed', 'at_port_abroad', 'in_transit', 'at_tanzania_port', 'at_tanzania_warehouse'];
    const q = this.search().trim().toLowerCase();
    return this.items().filter(item => !q || `${item.reference_number} ${this.label(item.status, item.transport_method)}`.toLowerCase().includes(q))
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.reference_number.localeCompare(b.reference_number));
  });
  readonly search = signal('');
  reference = '';
  readonly label = (status: string, method?: string | null): string => status === 'draft' ? 'Loading' : status === 'closed' ? 'Loaded' : getShipmentStageLabel(status, method);

  ngOnInit(): void { this.mode.set(this.transportMethod); this.load(); }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['shipmentId'] && !changes['shipmentId'].firstChange) { this.selected.set(null); this.load(); }
  }
  load(): void {
    this.listRequest?.unsubscribe();
    this.loading.set(true); this.error.set('');
    this.listRequest = this.api.getContainers(this.mode(), false, false, this.shipmentId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { this.mode.set(response.data.transport_method); this.methods.set(response.data.transport_methods); this.items.set(response.data.containers); this.loading.set(false); },
      error: error => { this.error.set(this.message(error)); this.loading.set(false); },
    });
  }
  setMode(mode: 'sea' | 'air'): void {
    if (mode === this.mode() || this.loading() || this.creating() || this.updating()) return;
    this.mode.set(mode); this.search.set(''); this.selected.set(null); this.reference = ''; this.load();
  }
  close(): void {
    if (this.creating() || this.updating() || this.closing()) return;
    this.closing.set(true); setTimeout(() => this.closed.emit(), 280);
  }
  create(): void {
    if (this.creating() || !this.reference.trim()) return;
    this.creating.set(true); this.error.set('');
    this.api.createContainer(this.reference, this.mode()).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.creating.set(false))).subscribe({
      next: response => { this.reference = ''; this.toast.success(response.message); this.load(); this.updated.emit(); },
      error: error => this.error.set(this.message(error)),
    });
  }
  open(container: Container): void {
    this.detailRequest?.unsubscribe();
    this.selected.set(container); this.detailLoading.set(true); this.detailError.set('');
    this.detailRequest = this.api.getContainer(container.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { if (this.selected()?.id === container.id) { this.selected.set(response.data.container); this.detailLoading.set(false); } },
      error: error => { if (this.selected()?.id === container.id) { this.detailError.set(this.message(error)); this.detailLoading.set(false); } },
    });
  }
  shipments(container: Container): (StaffShipmentDetail & { pivot_quantity?: number })[] { return container.shipments || []; }
  next(status: string): string | undefined { return ({ closed: 'at_port_abroad', at_port_abroad: 'in_transit', in_transit: 'at_tanzania_port', at_tanzania_port: 'at_tanzania_warehouse' } as Record<string, string>)[status]; }
  scan(container: Container): void {
    if (!container.staff_can_load) return;
    if (this.useScannerHere) this.scanRequested.emit(container);
    else this.router.navigate(['/staff/scan-qr'], { queryParams: { container: container.id } });
  }
  confirm(container: Container, next?: string): void { this.error.set(''); this.confirmation.set({ container, next }); }
  perform(): void {
    const operation = this.confirmation(); if (!operation || this.updating()) return;
    this.updating.set(true); this.error.set('');
    const request = operation.next ? this.api.updateContainerStatus(operation.container.id, operation.next) : this.api.closeContainer(operation.container.id);
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.updating.set(false))).subscribe({
      next: response => { this.confirmation.set(null); this.toast.success(response.message); if (this.selected()?.id === operation.container.id) this.selected.set(response.data.container); this.load(); this.updated.emit(); },
      error: error => { this.error.set(this.message(error)); this.confirmation.set(null); if (this.selected()) this.open(operation.container); this.load(); this.toast.error(this.message(error)); },
    });
  }
  private message(error: any): string { const first = Object.values(error?.error?.errors || {}).flat()[0]; return typeof first === 'string' ? first : error?.error?.message || 'Unable to load or update containers. Please try again.'; }
}
