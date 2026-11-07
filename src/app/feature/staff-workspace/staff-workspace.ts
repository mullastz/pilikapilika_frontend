import { Html5Qrcode } from 'html5-qrcode';
import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { AgencyService, StaffTask, TaskPage, TaskContainer, StaffAction } from '../../core/services/agency.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { getShipmentStageLabel, getStatusTextClass, getShipmentProgress, getShipmentProgressColor } from '../../core/helpers/shipment-progress.helper';

@Component({ selector: 'app-staff-workspace', imports: [CommonModule, FormsModule], templateUrl: './staff-workspace.html' })
export class StaffWorkspace implements OnInit, OnDestroy {
  private readonly api = inject(AgencyService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private scanner: Html5Qrcode | null = null;
  readonly cameraOpen = signal(false);
  readonly cameraError = signal('');
  private scanHandled = false;
  readonly data = signal<TaskPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedStage = signal('');
  readonly expanded = signal<string | null>(null);
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
    confirm: 'Confirm Booking', receive: 'Receive at Warehouse Abroad', add_received: 'Receive Remaining Units',
    load: 'Load Parcels', close_container: 'Finish Loading', advance_container: 'Update Transport Status',
    advance_parcel: 'Update Shipment Status', deliver: 'Confirm Client Collection', reject: 'Reject Booking',
  };
  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.request?.unsubscribe(); void this.stopScanner(); }
  openScanner(): void {
    this.cameraOpen.set(true); this.cameraError.set(''); this.scanHandled = false;
    setTimeout(() => { if (this.cameraOpen()) void this.startScanner(); }, 100);
  }
  private async startScanner(): Promise<void> {
    const scanner = new Html5Qrcode('staff-task-scanner'); this.scanner = scanner;
    try {
      await scanner.start({ facingMode: 'environment' }, { fps: 10 }, decoded => {
        if (this.scanHandled || !this.cameraOpen()) return;
        const uuid = decoded.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
        if (!uuid) { this.cameraError.set('This QR code does not identify a parcel. Try another code.'); return; }
        this.scanHandled = true; this.search = uuid; this.selectedStage.set('');
        void this.closeScanner(); this.load();
      }, () => {});
      if (!this.cameraOpen() || this.scanner !== scanner) { try { await scanner.stop(); scanner.clear(); } catch {} }
    } catch {
      if (this.cameraOpen()) this.cameraError.set('Unable to open the camera. Allow camera access on a secure connection, or search by tracking number.');
    }
  }
  async closeScanner(): Promise<void> { this.cameraOpen.set(false); await this.stopScanner(); }
  private async stopScanner(): Promise<void> {
    const scanner = this.scanner; this.scanner = null;
    if (scanner) { try { if (scanner.isScanning) await scanner.stop(); scanner.clear(); } catch {} }
  }
  load(page = 1): void {
    this.request?.unsubscribe(); this.loading.set(true); this.error.set('');
    this.request = this.api.tasks(page, this.selectedStage(), this.search).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.data.set(response.data); this.loading.set(false);
        if (response.data.pagination.current_page > response.data.pagination.last_page) this.load(Math.max(1, response.data.pagination.last_page));
      },
      error: error => { this.error.set(this.message(error)); this.loading.set(false); if (error.status === 403) this.data.set(null); },
    });
  }
  selectStage(status: string): void { this.selectedStage.set(status); this.load(); }
  open(task: StaffTask, action: string): void {
    this.selectedTask.set(task); this.operation.set(action); this.operationError.set(''); this.quantity = null; this.containerId = '';
    const options = this.containerOptions();
    if (options.length === 1) this.containerId = options[0].id;
  }
  close(): void { if (!this.saving()) { this.selectedTask.set(null); this.operationError.set(''); } }
  containerOptions(): TaskContainer[] {
    const task = this.selectedTask(); if (!task) return [];
    if (this.operation() === 'load') return (this.data()?.draft_containers || []).filter(container => (container.transport_method || 'sea') === (task.transport_method || 'sea'));
    if (this.operation() === 'close_container') return task.containers.filter(container => container.status === 'draft' && this.hasContainerStage(container.status));
    return task.containers.filter(container => !!this.nextContainerStatus(container.status) && this.hasContainerStage(container.status));
  }
  private hasContainerStage(status: string): boolean {
    const stage = ({ draft: 'loading_container', closed: 'loaded_in_container', at_port_abroad: 'at_port_abroad', in_transit: 'in_transit', at_tanzania_port: 'at_tanzania_port' } as Record<string, string>)[status];
    return !!stage && !!this.data()?.stages.some(item => item.status === stage);
  }
  nextContainerStatus(status: string): string | undefined {
    return ({ closed: 'at_port_abroad', at_port_abroad: 'in_transit', in_transit: 'at_tanzania_port', at_tanzania_port: 'at_tanzania_warehouse' } as Record<string, string>)[status];
  }
  nextLabel(): string {
    const task = this.selectedTask();
    const container = this.containerOptions().find(item => item.id === this.containerId);
    const status = container ? this.nextContainerStatus(container.status) : undefined;
    return status ? this.statusLabel(status, task?.transport_method) : '';
  }
  nextParcelLabel(): string {
    const task = this.selectedTask(); if (!task) return '';
    const next = ({ loaded_in_container: 'at_port_abroad', at_port_abroad: 'in_transit', in_transit: 'at_tanzania_port', at_tanzania_port: 'at_tanzania_warehouse' } as Record<string, string>)[task.status];
    return next ? this.statusLabel(next, task.transport_method) : '';
  }
  maxQuantity(): number {
    const task = this.selectedTask(); if (!task) return 0;
    if (this.operation() === 'load') return Math.max(0, task.expected_quantity - task.loaded_quantity);
    if (this.operation() === 'add_received') return Math.max(0, task.expected_quantity - (task.received_quantity || 0));
    return task.expected_quantity;
  }
  needsQuantity(): boolean { return ['receive', 'add_received', 'load'].includes(this.operation()); }
  needsContainer(): boolean { return ['load', 'close_container', 'advance_container'].includes(this.operation()); }
  submit(): void {
    const task = this.selectedTask(); if (!task || this.saving()) return;
    const action: StaffAction = { action: this.operation(), expected_status: task.status };
    if (this.needsQuantity()) {
      if (this.quantity === null || !Number.isInteger(this.quantity) || this.quantity < 1 || this.quantity > this.maxQuantity()) { this.operationError.set(`Enter a whole number between 1 and ${this.maxQuantity()}.`); return; }
      if (action.action === 'receive') action.received_quantity = this.quantity;
      else if (action.action === 'add_received') action.additional_quantity = this.quantity;
      else action.quantity = this.quantity;
    }
    if (this.needsContainer()) {
      if (!this.containerOptions().some(container => container.id === this.containerId)) { this.operationError.set('Choose a container or air batch for this parcel.'); return; }
      action.container_id = this.containerId;
      if (action.action === 'advance_container') action.status = this.nextContainerStatus(this.containerOptions().find(container => container.id === this.containerId)!.status);
    }
    this.saving.set(true); this.operationError.set('');
    this.api.perform(task.id, action).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
      next: response => { this.toast.success(response.message); this.selectedTask.set(null); this.load(this.data()?.pagination.current_page || 1); },
      error: error => { this.operationError.set(this.message(error)); if (error.status === 409) this.load(this.data()?.pagination.current_page || 1); },
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
  logout(): void { this.auth.logout(); this.router.navigate(['/sign-in']); }
  private message(error: HttpErrorResponse): string {
    const errors = Object.values(error.error?.errors || {}).flat();
    return errors.find((value): value is string => typeof value === 'string') || error.error?.message || 'Unable to load or update your tasks. Please try again.';
  }
}
