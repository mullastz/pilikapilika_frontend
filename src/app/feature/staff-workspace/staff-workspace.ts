import { Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { AgencyService, StaffTask, TaskPage, TaskContainer, StaffAction, StaffShipmentDetail } from '../../core/services/agency.service';
import { ToastService } from '../../core/services/toast.service';
import { getShipmentStageLabel, getStatusTextClass, getShipmentProgress, getShipmentProgressColor } from '../../core/helpers/shipment-progress.helper';
import { Header } from '../../shared/header/header';
import { ShipmentStatusTabs, ShipmentStatusTab } from '../../shared/components/shipment-status-tabs/shipment-status-tabs';
import { resolveImageUrl } from '../../core/utils/image-url.util';
import { transportIcon, transportLabel } from '../../core/utils/transport-methods.util';
import { StaffContainers } from '../../shared/components/staff-containers/staff-containers';
import { MenuBarService } from '../../core/services/menu-bar.service';

@Component({ selector: 'app-staff-workspace', standalone: true, imports: [CommonModule, FormsModule, Header, ShipmentStatusTabs, QRCodeComponent, StaffContainers], templateUrl: './staff-workspace.html', styleUrl: '../shipping/shipping.css' })
export class StaffWorkspace implements OnInit, OnDestroy {
  private readonly api = inject(AgencyService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly menuBar = inject(MenuBarService);
  readonly searchMode = !!this.route.snapshot.data['searchMode'];
  readonly parcelMode = this.searchMode || !!this.route.snapshot.data['parcelMode'];
  readonly linkedShipmentId = signal<string | null>(this.route.snapshot.queryParamMap.get('for_parcel'));
  readonly containerManagerOpen = signal(false);
  @ViewChild('taskSearch') private taskSearch?: ElementRef<HTMLInputElement>;
  @ViewChild(StaffContainers) private containerDashboard?: StaffContainers;
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private viewRequest?: Subscription;
  readonly data = signal<TaskPage | null>(null);
  readonly canManageContainers = computed(() => !!this.data()?.can_manage_containers);
  readonly showContainerDashboard = computed(() => !this.parcelMode && this.canManageContainers());
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedStage = signal('');
  readonly transportMode = signal<'sea' | 'air'>(this.route.snapshot.queryParamMap.get('transport') === 'air' ? 'air' : 'sea');
  readonly showTransportToggle = computed(() => (this.data()?.transport_methods.length ?? 0) > 1);
  readonly taskTabs = computed<ShipmentStatusTab[]>(() => {
    const workspace = this.data();
    const labels: Record<string, string> = { loading_container: 'Loading', loaded_in_container: 'Loaded' };
    return [
      { id: '', label: this.parcelMode ? 'All Parcels' : 'All My Tasks', icon: 'fa-list', count: Object.values(workspace?.counts || {}).reduce((total, count) => total + Number(count), 0) },
      ...(workspace?.stages || []).map(stage => ({ id: stage.status, label: labels[stage.status] || getShipmentStageLabel(stage.status, this.transportMode()), count: Number(workspace?.counts[stage.status] || 0) })),
    ];
  });
  readonly viewModalOpen = signal(false);
  readonly viewModalLoading = signal(false);
  readonly viewModalClosing = signal(false);
  readonly viewModalError = signal<string | null>(null);
  readonly selectedShipmentDetail = signal<StaffShipmentDetail | null>(null);
  readonly selectedProductUuid = signal<string | null>(null);
  readonly productDetailsLoading = signal(new Set<string>());
  readonly productDetailsErrors = signal(new Map<string, string>());
  readonly warehousePartialConfirm = signal(false);
  readonly confirmationButtonLabel = signal('Confirm');
  readonly transportIcon = transportIcon;
  readonly transportLabel = transportLabel;
  readonly selectedTask = signal<StaffTask | null>(null);
  readonly operation = signal('');
  readonly saving = signal(false);
  readonly operationError = signal('');
  readonly showPassword = signal(false);
  readonly passwordBusy = signal(false);
  readonly passwordError = signal('');
  search = ''; quantity: number | null = null; containerId = '';
  currentPassword = ''; newPassword = ''; passwordConfirmation = '';
  readonly statusLabel = getShipmentStageLabel;
  readonly statusColor = getStatusTextClass;
  readonly progress = getShipmentProgress;
  readonly progressColor = getShipmentProgressColor;
  readonly actionLabels: Record<string, string> = {
    confirm: 'Confirm', receive: 'At Warehouse Abroad', add_received: 'Add Remaining Quantity',
    load: 'Load Parcels',
    advance_parcel: 'Update Shipment Status', deliver: 'Confirm Client Collection', reject: 'Reject', cancel: 'Cancel',
  };
  readonly actionIcons: Record<string, string> = {
    confirm: 'fa-check text-green-500', receive: 'fa-warehouse text-indigo-500', add_received: 'fa-plus text-blue-500',
    load: 'fa-dolly text-orange-500',
    advance_parcel: 'fa-truck text-blue-500', deliver: 'fa-check-double text-green-500', reject: 'fa-times text-red-500', cancel: 'fa-times text-gray-500',
  };
  constructor() {
    afterNextRender(() => { if (this.searchMode) this.taskSearch?.nativeElement.focus(); });
    effect(onCleanup => {
      if (this.containerManagerOpen() || this.viewModalOpen() || !!this.selectedTask() || this.showPassword()) {
        this.menuBar.hide(); onCleanup(() => this.menuBar.show());
      }
    });
  }
  ngOnInit(): void {
    this.load();
    const shipment = this.route.snapshot.queryParamMap.get('shipment');
    if (shipment) this.openViewModal({ id: shipment });
  }
  ngOnDestroy(): void { this.request?.unsubscribe(); this.viewRequest?.unsubscribe(); }
  openScanner(): void { this.router.navigate(['/staff/scan-qr']); }
  openParcels(): void { this.router.navigate(['/staff/parcels']); }
  openTasks(): void { this.router.navigate(['/staff/tasks']); }
  openShipmentContainers(task: StaffTask): void {
    this.router.navigate(['/staff/tasks'], { queryParams: { for_parcel: task.id, transport: task.transport_method === 'air' ? 'air' : 'sea' } });
  }
  clearContainerFilter(): void {
    this.linkedShipmentId.set(null);
    this.router.navigate([], { relativeTo: this.route, queryParams: { for_parcel: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  refreshWorkspace(): void { this.load(this.data()?.pagination.current_page || 1); this.containerDashboard?.load(); }
  load(page = 1): void {
    this.request?.unsubscribe(); this.loading.set(true); this.error.set('');
    this.request = this.api.tasks(page, this.selectedStage(), this.search, this.transportMode()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.transportMode.set(response.data.transport_method);
        if (this.selectedStage() && !response.data.stages.some(stage => stage.status === this.selectedStage())) {
          this.selectedStage.set(''); this.load(); return;
        }
        this.data.set(response.data); this.loading.set(false);
        if (response.data.pagination.current_page > response.data.pagination.last_page) this.load(Math.max(1, response.data.pagination.last_page));
      },
      error: error => { this.error.set(this.message(error)); this.loading.set(false); if (error.status === 403) this.data.set(null); },
    });
  }
  selectStage(status: string): void { this.selectedStage.set(status); this.load(); }
  setTransportMode(mode: 'sea' | 'air'): void {
    if (mode === this.transportMode() || this.saving()) return;
    this.transportMode.set(mode);
    this.load();
  }
  open(task: StaffTask, action: string): void {
    if (!this.visibleActions(task).includes(action)) return;
    this.selectedTask.set(task); this.operation.set(action); this.operationError.set(''); this.quantity = null; this.containerId = '';
    this.warehousePartialConfirm.set(false); this.confirmationButtonLabel.set('Confirm');
    const options = this.containerOptions();
    if (options.length === 1) this.containerId = options[0].id;
  }
  close(): void { if (!this.saving()) { this.selectedTask.set(null); this.operationError.set(''); } }

  isContainerManaged(task: StaffTask): boolean { return task.container_managed || task.containers.length > 0; }

  visibleActions(task: StaffTask): string[] {
    return task.actions.filter(action => !['close_container', 'advance_container'].includes(action)
      && (!this.isContainerManaged(task) || !['advance_parcel', 'cancel'].includes(action))
      && (action !== 'cancel' || !task.actions.includes('confirm')));
  }

  confirmationTitle(): string {
    return ({ confirm: 'Confirm Shipment', reject: 'Reject Shipment', cancel: 'Cancel Shipment', receive: 'Receive at Warehouse Abroad' } as Record<string, string>)[this.operation()] || this.actionLabels[this.operation()] || 'Update Shipment';
  }

  confirmationMessage(): string {
    return ({ confirm: 'Are you sure you want to confirm this shipment request?', reject: 'Are you sure you want to reject this shipment request?',
      cancel: 'Are you sure you want to cancel this shipment?', receive: 'Enter the number of units actually received at the warehouse abroad.' } as Record<string, string>)[this.operation()] || (this.selectedTask()?.title || '');
  }

  quantityChanged(): void { this.warehousePartialConfirm.set(false); this.confirmationButtonLabel.set('Confirm'); this.operationError.set(''); }

  openViewModal(task: { id: string }): void {
    this.viewRequest?.unsubscribe(); this.viewModalOpen.set(true); this.viewModalClosing.set(false); this.viewModalLoading.set(true);
    this.viewModalError.set(null); this.selectedShipmentDetail.set(null); this.selectedProductUuid.set(null);
    this.viewRequest = this.api.task(task.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { this.selectedShipmentDetail.set(response.data.shipment); this.viewModalLoading.set(false); },
      error: error => { this.viewModalError.set(this.message(error)); this.viewModalLoading.set(false); },
    });
  }

  closeViewModal(): void {
    this.viewRequest?.unsubscribe(); this.viewModalClosing.set(true);
    setTimeout(() => { this.viewModalOpen.set(false); this.viewModalClosing.set(false); this.viewModalLoading.set(false); this.selectedShipmentDetail.set(null); this.selectedProductUuid.set(null); }, 280);
  }

  selectProduct(id: string): void { if (id) this.selectedProductUuid.set(this.selectedProductUuid() === id ? null : id); }
  getProductUuid(product: { qr_code_uuid?: string; uuid?: string; id?: string | number }): string { return String(product.qr_code_uuid || product.uuid || product.id || ''); }
  getFullProduct(product: any): any { return product; }
  getProductPhotos(product: any): string[] { return Array.isArray(product.photos) ? product.photos.filter((photo: unknown): photo is string => typeof photo === 'string' && !!photo.trim()).map((photo: string) => resolveImageUrl(photo, '')) : []; }
  getShipmentDistribution(id: string) { const detail = this.selectedShipmentDetail(); return detail?.id === id ? { loading: false, data: detail.distribution } : null; }
  getDeliveryReadiness(id: string) { const detail = this.selectedShipmentDetail(); return detail?.id === id && detail.container_id ? { loading: false, data: detail.delivery_readiness } : null; }
  getStatusClass(status: string): string {
    switch (status) {
      case 'delivered':        return 'bg-green-100 text-green-600';
      case 'in_transit':       return 'bg-blue-100 text-blue-600';
      case 'at_warehouse':     return 'bg-indigo-100 text-indigo-600';
      case 'partially_received': return 'bg-yellow-100 text-yellow-600';
      case 'half_loaded':      return 'bg-amber-100 text-amber-600';
      case 'loading_container': return 'bg-orange-100 text-orange-600';
      case 'loaded_in_container': return 'bg-teal-100 text-teal-600';
      case 'at_tanzania_port': return 'bg-cyan-100 text-cyan-600';
      case 'at_tanzania_warehouse': return 'bg-sky-100 text-sky-600';
      case 'confirmed':        return 'bg-purple-100 text-purple-600';
      case 'pending_confirmation': return 'bg-yellow-100 text-yellow-600';
      case 'cancelled':        return 'bg-red-100 text-red-600';
      case 'draft':            return 'bg-gray-100 text-gray-600';
      case 'closed':           return 'bg-teal-100 text-teal-600';
      default:                 return 'bg-gray-200 text-gray-600';
    }
  }
  isAgent(): boolean { return true; }
  formatStatus(status: string, transport?: string | null): string { return this.statusLabel(status, transport); }
  containerTerm(shipment: { transport_method?: string | null }, plural = false): string { return shipment.transport_method === 'air' ? (plural ? 'Batches' : 'Batch') : (plural ? 'Containers' : 'Container'); }
  capitalize(value: string | null | undefined): string { return value ? value.toString().toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : ''; }
  formatDate(value: string | undefined): string { return value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }
  containerOptions(): TaskContainer[] {
    const task = this.selectedTask(); if (!task) return [];
    if (this.operation() === 'load') return (this.data()?.draft_containers || []).filter(container => (container.transport_method || 'sea') === (task.transport_method || 'sea'));
    return [];
  }
  nextParcelLabel(): string {
    const task = this.selectedTask(); if (!task) return '';
    const next = ({ loaded_in_container: 'at_port_abroad', at_port_abroad: 'in_transit', in_transit: 'at_tanzania_port', at_tanzania_port: 'at_tanzania_warehouse' } as Record<string, string>)[task.status];
    return next ? this.statusLabel(next, task.transport_method) : '';
  }
  private remainingQuantity(): number {
    const task = this.selectedTask(); if (!task) return 0;
    if (this.operation() === 'load') return Math.max(0, task.expected_quantity - task.loaded_quantity);
    if (this.operation() === 'add_received') return Math.max(0, task.expected_quantity - (task.received_quantity || 0));
    return task.expected_quantity;
  }
  private hasStage(status: string): boolean { return !!this.data()?.assigned_stages.some(stage => stage.status === status); }
  minQuantity(): number {
    const partial = this.operation() === 'load' ? 'half_loaded' : 'partially_received';
    return this.hasStage(partial) ? 1 : Math.max(1, this.remainingQuantity());
  }
  maxQuantity(): number {
    const complete = this.operation() === 'load' ? 'loading_container' : 'at_warehouse';
    return Math.max(0, this.remainingQuantity() - (this.hasStage(complete) ? 0 : 1));
  }
  needsQuantity(): boolean { return ['receive', 'add_received', 'load'].includes(this.operation()); }
  needsContainer(): boolean { return this.operation() === 'load'; }
  submit(): void {
    const task = this.selectedTask(); if (!task || this.saving()) return;
    const action: StaffAction = { action: this.operation(), expected_status: task.status };
    if (this.needsQuantity()) {
      if (this.quantity === null || !Number.isInteger(this.quantity) || this.quantity < this.minQuantity() || this.quantity > this.maxQuantity()) { this.operationError.set(`Enter a whole number between ${this.minQuantity()} and ${this.maxQuantity()}.`); return; }
      if (action.action === 'receive' && this.quantity < task.expected_quantity && !this.warehousePartialConfirm()) {
        this.warehousePartialConfirm.set(true); this.confirmationButtonLabel.set('Confirm Partial Receipt'); return;
      }
      if (action.action === 'receive') action.received_quantity = this.quantity;
      else if (action.action === 'add_received') action.additional_quantity = this.quantity;
      else action.quantity = this.quantity;
    }
    if (this.needsContainer()) {
      if (!this.containerOptions().some(container => container.id === this.containerId)) { this.operationError.set('Choose a container or air batch for this parcel.'); return; }
      action.container_id = this.containerId;
    }
    this.saving.set(true); this.operationError.set('');
    this.api.perform(task.id, action).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
      next: response => { this.toast.success(response.message); this.selectedTask.set(null); this.load(this.data()?.pagination.current_page || 1); },
      error: error => { this.operationError.set(this.message(error)); if (error.status === 409 || error.status === 403) this.load(this.data()?.pagination.current_page || 1); },
    });
  }
  changePassword(): void {
    if (this.passwordBusy()) return;
    if (this.newPassword.length < 8 || this.newPassword !== this.passwordConfirmation) { this.passwordError.set('Use at least eight characters and make sure your new passwords match.'); return; }
    this.passwordBusy.set(true); this.passwordError.set('');
    this.api.changePassword(this.currentPassword, this.newPassword, this.passwordConfirmation).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.passwordBusy.set(false))).subscribe({
      next: () => { this.currentPassword = ''; this.newPassword = ''; this.passwordConfirmation = ''; this.showPassword.set(false); this.toast.success('Password changed.'); },
      error: error => this.passwordError.set(this.message(error)),
    });
  }
  private message(error: HttpErrorResponse): string {
    const errors = Object.values(error.error?.errors || {}).flat();
    return errors.find((value): value is string => typeof value === 'string') || error.error?.message || 'Unable to load or update your tasks. Please try again.';
  }
}
