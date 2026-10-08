import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';
import { ShipmentService } from '../../core/services/shipment.service';
import { ContainerService, Container } from '../../core/services/container.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { localizeShipmentLabel } from '../../core/helpers/shipment-progress.helper';

type ScanState = 'idle' | 'scanning' | 'quantity_input' | 'partial_confirm' | 'add_remaining' | 'container_picker' | 'load_quantity_input' | 'container_detail' | 'processing' | 'success' | 'info' | 'error';

interface ShipmentDistributionState {
  loading: boolean;
  error: string | null;
  data: { expected_quantity: number; loaded_quantity: number; remaining_quantity: number; is_fully_loaded: boolean; containers: { reference_number: string; quantity: number }[] } | null;
}

@Component({
  selector: 'app-scan-qr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scan-qr.html',
  styleUrl: './scan-qr.css'
})
export class ScanQr implements OnInit, OnDestroy {
  private router = inject(Router);
  private shipmentService = inject(ShipmentService);
  private containerService = inject(ContainerService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  html5QrCode: Html5Qrcode | null = null;
  private scanHandled = false;
  private lastScanTime = 0;
  state = signal<ScanState>('idle');
  cameraError = signal<string | null>(null);
  cameraErrorDetail = signal<string | null>(null);
  resultShipment = signal<any | null>(null);
  infoMessage = signal<string>('');
  errorMessage = signal<string>('');

  // Quantity input state
  pendingQrUuid = signal<string | null>(null);
  expectedQuantity = signal<number | null>(null);
  receivedQuantity = signal<number | null>(null);
  quantityError = signal<string>('');

  // Partial receipt / add remaining state
  partialReceiptData = signal<{
    expected: number;
    received: number;
    remaining: number;
    shipment: any;
  } | null>(null);
  addRemainingQuantity = signal<number | null>(null);
  addRemainingError = signal<string>('');

  // Load flow state (at_warehouse / half_loaded → container/batch)
  loadShipment = signal<any | null>(null);
  loadableContainers = signal<Container[]>([]);
  containersLoading = signal<boolean>(false);
  selectedContainer = signal<Container | null>(null);
  loadQuantity = signal<number | null>(null);
  loadQuantityError = signal<string>('');
  containerStatusData = signal<{ expected_quantity: number; loaded_quantity: number; remaining_quantity: number; is_fully_loaded: boolean; containers: { reference_number: string; quantity: number }[] } | null>(null);
  containerStatusLoading = signal<boolean>(false);
  containerStatusError = signal<string | null>(null);
  loadingShipment = signal<boolean>(false);

  // Container/batch management state (scan-driven, from picker/detail)
  newContainerRef = signal<string>('');
  creatingContainer = signal<boolean>(false);
  updatingContainer = signal<string | null>(null);
  detailContainer = signal<Container | null>(null);
  detailLoading = signal<boolean>(false);
  shipmentDistributions = signal<Record<string, ShipmentDistributionState>>({});

  // Sheet-modal closing flags (for close animations)
  pickerClosing = signal<boolean>(false);
  loadQuantityClosing = signal<boolean>(false);
  detailClosing = signal<boolean>(false);
  /** True when the detail sheet was opened from the picker — closing returns there */
  detailFromPicker = signal<boolean>(false);

  ngOnInit(): void {
    const user = this.authService.getUser();
    const role = user?.role?.toLowerCase();
    if (role !== 'agent' && role !== 'seller') {
      this.toastService.error('Only agents can access the QR scanner');
      this.router.navigate(['/home']);
      return;
    }
  }

  ngOnDestroy(): void {
    this.stopScanner();
  }

  async beginScanning(): Promise<void> {
    await this.stopScanner();
    this.scanHandled = false;
    this.lastScanTime = 0;
    this.state.set('scanning');
    this.cameraError.set(null);
    this.cameraErrorDetail.set(null);

    // Defer slightly so DOM is ready
    setTimeout(() => this.startScanner(), 100);
  }

  async startScanner(): Promise<void> {
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure) {
      this.state.set('error');
      this.errorMessage.set('Camera access requires a secure connection (HTTPS). Please access this page via HTTPS or localhost for development.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.state.set('error');
      this.errorMessage.set('Your browser does not support camera access. Please use Chrome, Safari, or Edge.');
      return;
    }

    const readerEl = document.getElementById('reader');
    if (!readerEl) {
      this.state.set('error');
      this.errorMessage.set('Scanner element not found. Please try again.');
      return;
    }

    // Explicitly request camera permission first — this triggers the browser
    // permission prompt on devices where html5-qrcode.start() fails to do so.
    try {
      const fallbackConstraints = { video: true };
      const preferredConstraints = { video: { facingMode: 'environment' } };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }
      // Stop all tracks so html5-qrcode can take over the camera cleanly
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      console.error('Camera permission error:', err);
      const name = err?.name || '';
      const msg = err?.message || '';

      if (name === 'NotAllowedError' || msg.includes('Permission denied') || msg.includes('permission')) {
        this.cameraError.set('Camera access denied.');
        this.cameraErrorDetail.set('Please allow camera permission when prompted, or reset it in your browser settings and tap Try Again.');
      } else if (name === 'NotFoundError' || msg.includes('device not found') || msg.includes('no camera')) {
        this.cameraError.set('No camera found on this device.');
        this.cameraErrorDetail.set('Make sure your device has a working camera and it is not being used by another app.');
      } else if (name === 'NotReadableError' || msg.includes('in use') || msg.includes('busy')) {
        this.cameraError.set('Camera is already in use.');
        this.cameraErrorDetail.set('Another app or browser tab is using the camera. Please close it and tap Try Again.');
      } else {
        this.cameraError.set('Unable to start camera.');
        this.cameraErrorDetail.set(msg || 'An unexpected error occurred. Please tap Try Again.');
      }
      this.state.set('error');
      return;
    }

    this.html5QrCode = new Html5Qrcode('reader');

    try {
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10 },
        (decodedText: string) => {
          if (this.scanHandled || this.state() !== 'scanning') return;
          // Extra debounce: ignore scans within 3 seconds of a previous scan
          const now = Date.now();
          if (now - this.lastScanTime < 3000) return;
          this.lastScanTime = now;
          this.scanHandled = true;
          this.handleScan(decodedText);
        },
        () => {
          // ignore scan failures (no QR in frame)
        }
      );
    } catch (err: any) {
      console.error('Camera error:', err);
      const name = err?.name || '';
      const msg = err?.message || '';

      if (name === 'NotAllowedError' || msg.includes('Permission denied') || msg.includes('permission')) {
        this.cameraError.set('Camera access denied.');
        this.cameraErrorDetail.set('Please allow camera permission when prompted, or reset it in your browser settings and tap Try Again.');
      } else if (name === 'NotFoundError' || msg.includes('device not found') || msg.includes('no camera')) {
        this.cameraError.set('No camera found on this device.');
        this.cameraErrorDetail.set('Make sure your device has a working camera and it is not being used by another app.');
      } else if (name === 'NotReadableError' || msg.includes('in use') || msg.includes('busy')) {
        this.cameraError.set('Camera is already in use.');
        this.cameraErrorDetail.set('Another app or browser tab is using the camera. Please close it and tap Try Again.');
      } else {
        this.cameraError.set('Unable to start camera.');
        this.cameraErrorDetail.set(msg || 'An unexpected error occurred. Please tap Try Again.');
      }
      this.state.set('error');
    }
  }

  async stopScanner(): Promise<void> {
    if (this.html5QrCode) {
      try {
        await this.html5QrCode.stop();
        await this.html5QrCode.clear();
      } catch {
        // ignore cleanup errors
      }
      this.html5QrCode = null;
    }
  }

  async handleScan(decodedText: string): Promise<void> {
    await this.stopScanner();
    const uuid = this.extractUuid(decodedText);
    if (!uuid) {
      this.toastService.error('Invalid QR code');
      this.state.set('error');
      this.errorMessage.set('Invalid QR code');
      return;
    }

    // Step 1: Preview — get shipment info without modifying status
    this.state.set('processing');
    this.shipmentService.approveByQrCode(uuid, undefined, true).subscribe({
      next: (response) => {
        if (response.success && response.preview) {
          const shipment = response.data?.shipment ?? null;
          // Check if shipment is in a state where we can receive it
          const status = shipment?.status;
          if (status === 'pending_confirmation' || status === 'confirmed') {
            // Show quantity input before approving
            const data = (response as any).data;
            this.showQuantityInput(shipment, uuid, data?.expected_quantity ?? null);
          } else if (status === 'partially_received') {
            // Re-scanning a partially received shipment — show add remaining modal
            // Use the pre-calculated quantities from the backend response
            const data = (response as any).data;
            this.showAddRemainingModalFromData(
              shipment,
              data?.expected_quantity ?? this.getExpectedQuantityFromShipment(shipment),
              data?.received_quantity ?? shipment?.received_quantity ?? 0,
              data?.remaining_quantity ?? 0
            );
          } else if (status === 'at_warehouse' || status === 'half_loaded') {
            // Load flow — pick a container/batch and load (fully or partially)
            this.startLoadFlow(shipment);
          } else if (shipment?.container_id) {
            // Already inside a container/batch — show that container's detail
            this.openContainerDetailFromScan(shipment);
          } else {
            // Already processed — show info state
            this.resultShipment.set(shipment);
            this.infoMessage.set(this.getStatusMessage(status || ''));
            this.state.set('info');
          }
        } else if (response.success && response.info) {
          // Info: shipment found but already at some status
          this.resultShipment.set(response.data?.shipment ?? null);
          this.infoMessage.set(response.message);
          this.state.set('info');
          this.toastService.info(response.message);
        } else if (response.success) {
          // Direct success (shouldn't happen in preview mode but handle gracefully)
          this.resultShipment.set(response.data?.shipment ?? null);
          this.state.set('success');
          this.toastService.success(response.message);
        } else {
          this.state.set('error');
          this.errorMessage.set(response.message || 'Invalid QR code');
          this.toastService.error(response.message || 'Invalid QR code');
        }
      },
      error: (err: any) => {
        const status = err?.status;
        let message = 'Something went wrong. Please try again.';
        if (status === 404) {
          message = 'Invalid QR code';
        } else if (status === 429) {
          message = err?.error?.message || 'Please wait a moment before scanning again.';
        } else if (status === 403) {
          message = err?.error?.message || 'Only agents can approve shipments';
        } else if (status === 422) {
          message = err?.error?.message || 'Invalid QR code';
        }
        this.state.set('error');
        this.errorMessage.set(message);
        this.toastService.error(message);
      }
    });
  }

  extractUuid(text: string): string | null {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = text.match(uuidRegex);
    return match ? match[0] : null;
  }

  getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      'at_warehouse': 'Shipment is already at warehouse',
      'partially_received': 'Shipment is partially received — awaiting confirmation or remaining quantity',
      'half_loaded': 'Shipment is partially loaded in a container',
      'at_port_abroad': 'Shipment is already at port abroad',
      'in_transit': 'Shipment is already in transit',
      'delivered': 'Shipment is already delivered',
      'cancelled': 'Shipment is already cancelled',
      'loading_container': 'Shipment is being loaded into a container',
      'loaded_in_container': 'Shipment is already loaded in a container',
      'at_tanzania_port': 'Shipment is at Tanzania port',
      'at_tanzania_warehouse': 'Shipment is at Tanzania warehouse',
    };
    return messages[status] || 'Shipment found';
  }

  // Quantity input flow
  showQuantityInput(shipment: any, uuid: string, expectedFromResponse?: number | null): void {
    this.pendingQrUuid.set(uuid);
    const qty = this.deriveExpectedQuantity(shipment) ?? expectedFromResponse ?? null;
    if (qty === null || qty < 1) {
      this.toastService.error('Could not determine expected quantity for this shipment.');
      this.state.set('error');
      this.errorMessage.set('Could not determine expected quantity for this shipment.');
      return;
    }
    this.expectedQuantity.set(qty);
    this.receivedQuantity.set(qty); // Default to expected quantity
    this.quantityError.set('');
    this.state.set('quantity_input');
  }

  submitQuantity(): void {
    const uuid = this.pendingQrUuid();
    if (!uuid) return;

    const qty = this.receivedQuantity();
    if (qty === null || qty === undefined || isNaN(qty) || !Number.isInteger(qty) || qty < 1) {
      this.quantityError.set('Please enter a valid quantity (at least 1).');
      return;
    }

    const expected = this.expectedQuantity();
    if (expected !== null && qty > expected) {
      this.quantityError.set(`Quantity cannot exceed the expected quantity of ${expected}.`);
      return;
    }
    if (expected !== null && qty < expected) {
      // Show partial receipt confirmation before submitting
      this.partialReceiptData.set({
        expected: expected,
        received: qty,
        remaining: expected - qty,
        shipment: null
      });
      this.state.set('partial_confirm');
      return;
    }

    this.quantityError.set('');
    this.state.set('processing');

    this.doApproveByQrCode(uuid, qty);
  }

  private doApproveByQrCode(uuid: string, qty: number): void {
    this.shipmentService.approveByQrCode(uuid, qty).subscribe({
      next: (response) => {
        if (response.success && (response as any).partial_receipt) {
          this.resultShipment.set(response.data?.shipment ?? null);
          this.state.set('success');
          this.toastService.warning(response.message);
        } else if (response.success) {
          this.resultShipment.set(response.data?.shipment ?? null);
          this.state.set('success');
          this.toastService.success(response.message);
        } else {
          this.state.set('error');
          this.errorMessage.set(response.message || 'Failed to approve shipment');
          this.toastService.error(response.message || 'Failed to approve shipment');
        }
      },
      error: (err: any) => {
        const status = err?.status;
        let message = 'Something went wrong. Please try again.';
        if (status === 404) {
          message = 'Invalid QR code';
        } else if (status === 429) {
          message = err?.error?.message || 'Please wait a moment before scanning again.';
        } else if (status === 403) {
          message = err?.error?.message || 'Only agents can approve shipments';
        } else if (status === 422) {
          message = err?.error?.message || 'Invalid input';
        }
        this.state.set('error');
        this.errorMessage.set(message);
        this.toastService.error(message);
      }
    });
  }

  cancelQuantityInput(): void {
    this.pendingQrUuid.set(null);
    this.expectedQuantity.set(null);
    this.receivedQuantity.set(null);
    this.quantityError.set('');
    this.resetToIdle();
  }

  onQuantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    this.receivedQuantity.set(isNaN(val) ? null : val);
    this.quantityError.set('');
  }

  // Partial receipt confirmation
  confirmPartialReceipt(): void {
    const uuid = this.pendingQrUuid();
    const qty = this.receivedQuantity();
    if (!uuid || qty === null) return;
    this.state.set('processing');
    this.doApproveByQrCode(uuid, qty);
  }

  cancelPartialConfirm(): void {
    this.partialReceiptData.set(null);
    this.state.set('quantity_input');
  }

  // Add remaining quantity (re-scan flow)
  showAddRemainingModal(shipment: any): void {
    const expected = this.getExpectedQuantityFromShipment(shipment);
    const received = shipment?.received_quantity ?? 0;
    this.partialReceiptData.set({
      expected: expected,
      received: received,
      remaining: Math.max(0, expected - received),
      shipment: shipment
    });
    this.addRemainingQuantity.set(null);
    this.addRemainingError.set('');
    this.state.set('add_remaining');
  }

  showAddRemainingModalFromData(shipment: any, expected: number, received: number, remaining: number): void {
    this.partialReceiptData.set({
      expected: expected,
      received: received,
      remaining: Math.max(0, remaining),
      shipment: shipment
    });
    this.addRemainingQuantity.set(null);
    this.addRemainingError.set('');
    this.state.set('add_remaining');
  }

  getExpectedQuantityFromShipment(shipment: any): number {
    return this.deriveExpectedQuantity(shipment) ?? 1;
  }

  /**
   * Robustly extract the expected quantity from a shipment.
   * Handles products stored as a JSON string, single- and double-nested
   * product arrays, string quantities, and a top-level quantity field.
   * Returns null when no quantity source exists.
   */
  deriveExpectedQuantity(shipment: any): number | null {
    const parseQty = (value: any): number | null => {
      if (typeof value !== 'number' && typeof value !== 'string') return null;
      const qty = parseInt(String(value), 10);
      return isNaN(qty) || qty < 1 ? null : qty;
    };

    let products = shipment?.products ?? [];
    // Some rows may still arrive as a JSON string
    if (typeof products === 'string') {
      try {
        products = JSON.parse(products);
      } catch {
        products = [];
      }
    }
    if (Array.isArray(products) && products.length > 0) {
      let first = products[0];
      // Handle nested array: [[{quantity: 12}]]
      if (Array.isArray(first) && first.length > 0) {
        first = first[0];
      }
      const qty = parseQty(first?.quantity);
      if (qty !== null) return qty;
    }

    // Fallback: quantity directly on the shipment
    return parseQty(shipment?.quantity);
  }

  onAddRemainingInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    this.addRemainingQuantity.set(isNaN(val) ? null : val);
    this.addRemainingError.set('');
  }

  submitAddRemaining(): void {
    const data = this.partialReceiptData();
    const qty = this.addRemainingQuantity();
    if (!data || qty === null || qty === undefined || qty < 1 || isNaN(qty)) {
      this.addRemainingError.set('Please enter a valid quantity (1 or more)');
      return;
    }
    if (qty > data.remaining) {
      this.addRemainingError.set(`Cannot exceed remaining quantity (${data.remaining})`);
      return;
    }

    this.addRemainingError.set('');
    this.state.set('processing');

    const shipmentId = data.shipment?.id;
    if (!shipmentId) {
      this.state.set('error');
      this.errorMessage.set('Shipment ID not found');
      return;
    }

    this.shipmentService.addReceivedQuantity(shipmentId, qty).subscribe({
      next: (response) => {
        if (response.success) {
          this.resultShipment.set(response.data?.shipment ?? null);
          this.state.set('success');
          this.toastService.success(response.message);
        } else {
          this.state.set('error');
          this.errorMessage.set(response.message || 'Failed to add quantity');
          this.toastService.error(response.message || 'Failed to add quantity');
        }
      },
      error: (err: any) => {
        const message = err?.error?.message || 'Something went wrong. Please try again.';
        this.state.set('error');
        this.errorMessage.set(message);
        this.toastService.error(message);
      }
    });
  }

  cancelAddRemaining(): void {
    this.partialReceiptData.set(null);
    this.addRemainingQuantity.set(null);
    this.addRemainingError.set('');
    this.resetToIdle();
  }

  // Load flow (at_warehouse / half_loaded → container/batch)

  /**
   * Transport-aware wording: air freight uses "Batch",
   * sea freight (and unset) uses "Container".
   */
  containerTerm(plural = false): string {
    const air = this.loadShipment()?.transport_method === 'air' || this.selectedContainer()?.transport_method === 'air';
    if (plural) return air ? 'Batches' : 'Containers';
    return air ? 'Batch' : 'Container';
  }

  startLoadFlow(shipment: any): void {
    // Duplicate-load guard: check if everything is already loaded
    this.shipmentService.getContainerStatus(shipment.id).subscribe({
      next: (statusResponse) => {
        if (statusResponse.success && statusResponse.data?.is_fully_loaded) {
          // Fully loaded — show the container it lives in when known
          if (shipment?.container_id) {
            this.openContainerDetailFromScan(shipment);
            return;
          }
          this.resultShipment.set(shipment);
          this.infoMessage.set('All quantity of this shipment is already loaded.');
          this.state.set('info');
          this.toastService.info('All quantity of this shipment is already loaded.');
          return;
        }
        this.openContainerPicker(shipment);
      },
      error: () => {
        // If status fetch fails, still offer the picker — backend validates on submit
        this.openContainerPicker(shipment);
      }
    });
  }

  openContainerPicker(shipment: any): void {
    this.loadShipment.set(shipment);
    this.loadQuantity.set(null);
    this.loadQuantityError.set('');
    this.containerStatusData.set(null);
    this.containerStatusError.set(null);

    // If a container was pre-selected (Scan to Load from the manager/detail view),
    // skip the picker and go straight to the quantity modal
    const preset = this.selectedContainer();
    if (preset && preset.status === 'draft' && (!preset.transport_method || !shipment?.transport_method || preset.transport_method === shipment.transport_method)) {
      this.selectContainer(preset);
      return;
    }
    this.selectedContainer.set(null);

    this.containersLoading.set(true);
    this.pickerClosing.set(false);
    this.newContainerRef.set('');
    this.state.set('container_picker');

    // Only list draft (open) containers/batches matching the shipment's transport method
    const transportMethod = shipment?.transport_method ?? null;
    this.containerService.getContainers(transportMethod).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadableContainers.set((response.data?.containers ?? []).filter(c =>
            c.status === 'draft' && (!transportMethod || !c.transport_method || c.transport_method === transportMethod)
          ));
        }
        this.containersLoading.set(false);
      },
      error: () => {
        this.loadableContainers.set([]);
        this.containersLoading.set(false);
      }
    });
  }

  /** Inline creation from the picker — always uses the scanned shipment's transport method */
  createContainerForShipment(): void {
    const shipment = this.loadShipment();
    const ref = this.newContainerRef().trim();
    if (!ref) {
      this.toastService.error('Please enter a reference number');
      return;
    }
    const transportMethod = shipment?.transport_method ?? null;
    this.creatingContainer.set(true);
    this.containerService.createContainer(ref, transportMethod).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success(`${this.containerTerm()} created successfully`);
          this.newContainerRef.set('');
          // Refresh the picker list so the new container/batch shows up
          const created = response.data?.container;
          if (created && created.status === 'draft') {
            this.loadableContainers.update(list => [...list, created]);
          } else if (shipment) {
            this.containersLoading.set(true);
            this.containerService.getContainers(shipment?.transport_method ?? null).subscribe({
              next: (res) => {
                if (res.success) {
                  this.loadableContainers.set((res.data?.containers ?? []).filter(c => c.status === 'draft'));
                }
                this.containersLoading.set(false);
              },
              error: () => this.containersLoading.set(false)
            });
          }
        } else {
          this.toastService.error(response.message || `Failed to create ${this.containerTerm().toLowerCase()}`);
        }
        this.creatingContainer.set(false);
      },
      error: (error: any) => {
        console.error('Failed to create container:', error);
        // Surface the first server validation error (e.g. duplicate reference number)
        const errors = error?.error?.errors;
        const firstError = errors ? Object.values(errors).flat()[0] as string : null;
        this.toastService.error(firstError || `Failed to create ${this.containerTerm().toLowerCase()}`);
        this.creatingContainer.set(false);
      }
    });
  }

  selectContainer(container: Container): void {
    const shipment = this.loadShipment();
    if (!shipment) return;

    this.selectedContainer.set(container);
    this.loadQuantity.set(null);
    this.loadQuantityError.set('');
    this.containerStatusData.set(null);
    this.containerStatusError.set(null);
    this.state.set('load_quantity_input');

    // Only fetch container status for half_loaded shipments
    // For at_warehouse, max is simply the expected product quantity
    if (shipment.status === 'half_loaded') {
      this.containerStatusLoading.set(true);
      this.shipmentService.getContainerStatus(shipment.id).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.containerStatusData.set(response.data);
            this.containerStatusError.set(null);
          } else {
            this.containerStatusError.set('Failed to load container status');
          }
          this.containerStatusLoading.set(false);
        },
        error: () => {
          this.containerStatusError.set('Failed to load container status. Please try again.');
          this.containerStatusLoading.set(false);
        }
      });
    }
  }

  getMaxLoadQuantity(): number {
    const shipment = this.loadShipment();
    if (!shipment) return 1;

    const expected = this.getExpectedQuantityFromShipment(shipment);

    // For at_warehouse, max is the total
    if (shipment.status === 'at_warehouse') {
      return expected;
    }

    // For half_loaded, max is the remaining
    const statusData = this.containerStatusData();
    return statusData?.remaining_quantity ?? expected;
  }

  onLoadQuantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    this.loadQuantity.set(isNaN(val) ? null : val);
    this.loadQuantityError.set('');
  }

  submitLoadWithQuantity(): void {
    const container = this.selectedContainer();
    const shipment = this.loadShipment();
    if (!container || !shipment) return;

    const qty = this.loadQuantity();
    if (qty === null || qty === undefined || qty < 1 || isNaN(qty)) {
      this.loadQuantityError.set('Please enter a valid quantity (1 or more)');
      return;
    }

    const maxQty = this.getMaxLoadQuantity();
    if (qty > maxQty) {
      this.loadQuantityError.set(`Cannot load more than ${maxQty} unit(s)`);
      return;
    }

    this.doLoadShipment(container.id, shipment.id, qty);
  }

  loadAllQuantity(): void {
    const container = this.selectedContainer();
    const shipment = this.loadShipment();
    if (!container || !shipment) return;

    const expected = this.getExpectedQuantityFromShipment(shipment);
    this.doLoadShipment(container.id, shipment.id, expected);
  }

  loadAllRemainingQuantity(): void {
    const container = this.selectedContainer();
    const shipment = this.loadShipment();
    if (!container || !shipment) return;

    const statusData = this.containerStatusData();
    const remaining = statusData?.remaining_quantity ?? this.getExpectedQuantityFromShipment(shipment);
    this.doLoadShipment(container.id, shipment.id, remaining);
  }

  private doLoadShipment(containerId: string, shipmentId: string, qty: number): void {
    this.loadQuantityError.set('');
    this.loadingShipment.set(true);
    this.containerService.addShipment(containerId, shipmentId, qty).subscribe({
      next: (response) => {
        if (response.success) {
          this.resultShipment.set(response.data?.shipment ?? this.loadShipment());
          this.state.set('success');
          this.toastService.success(response.message || `Shipment loaded into ${this.containerTerm().toLowerCase()} ${this.selectedContainer()?.reference_number}.`);
        } else {
          this.loadQuantityError.set(response.message || 'Failed to add shipment');
          this.toastService.error(response.message || 'Failed to add shipment');
        }
        this.loadingShipment.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || 'Failed to add shipment to container';
        this.loadQuantityError.set(message);
        this.toastService.error(message);
        this.loadingShipment.set(false);
      }
    });
  }

  cancelLoadFlow(): void {
    this.loadShipment.set(null);
    this.loadableContainers.set([]);
    this.containersLoading.set(false);
    this.selectedContainer.set(null);
    this.loadQuantity.set(null);
    this.loadQuantityError.set('');
    this.containerStatusData.set(null);
    this.containerStatusLoading.set(false);
    this.containerStatusError.set(null);
    this.resetToIdle();
  }

  backToContainerPicker(): void {
    const shipment = this.loadShipment();
    this.selectedContainer.set(null);
    if (shipment) {
      // Re-run the picker (loads the container list if it was skipped via Scan to Load)
      this.openContainerPicker(shipment);
      return;
    }
    this.loadQuantity.set(null);
    this.loadQuantityError.set('');
    this.containerStatusData.set(null);
    this.containerStatusLoading.set(false);
    this.containerStatusError.set(null);
    this.state.set('container_picker');
  }

  // Container/batch management (ported from the shipping page)

  /** Wording for a specific container/batch based on its own transport method */
  containerTermFor(container: Container | null, plural = false): string {
    const air = container?.transport_method === 'air';
    if (plural) return air ? 'Batches' : 'Containers';
    return air ? 'Batch' : 'Container';
  }

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

  formatStatus(status: string, transportMethod?: string | null): string {
    const label = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return localizeShipmentLabel(label, transportMethod);
  }

  closeContainer(containerId: string): void {
    this.updatingContainer.set(containerId);
    this.containerService.closeContainer(containerId).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Container closed successfully');
          this.refreshContainerDetail(containerId);
        } else {
          this.toastService.error(response.message || 'Failed to close container');
        }
        this.updatingContainer.set(null);
      },
      error: (error: any) => {
        console.error('Failed to close container:', error);
        this.toastService.error('Failed to close container');
        this.updatingContainer.set(null);
      }
    });
  }

  updateContainerStatus(containerId: string, status: string): void {
    this.updatingContainer.set(containerId);
    this.containerService.updateContainerStatus(containerId, status).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success(`Container updated to ${status.replace(/_/g, ' ')}`);
          this.refreshContainerDetail(containerId);
        } else {
          this.toastService.error(response.message || 'Failed to update container');
        }
        this.updatingContainer.set(null);
      },
      error: (error: any) => {
        console.error('Failed to update container status:', error);
        this.toastService.error('Failed to update container status');
        this.updatingContainer.set(null);
      }
    });
  }

  getNextContainerStatus(status: string): string | null {
    const flow: Record<string, string> = {
      'closed': 'at_port_abroad',
      'at_port_abroad': 'in_transit',
      'in_transit': 'at_tanzania_port',
      'at_tanzania_port': 'at_tanzania_warehouse',
    };
    return flow[status] || null;
  }

  getNextContainerStatusLabel(status: string, transportMethod?: string | null): string {
    const next = this.getNextContainerStatus(status);
    if (!next) return '';
    const label = next.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return localizeShipmentLabel(label, transportMethod);
  }

  // Container detail view
  openContainerDetail(container: Container, fromPicker = false): void {
    this.detailContainer.set(container);
    this.shipmentDistributions.set({});
    this.detailLoading.set(true);
    this.detailClosing.set(false);
    this.detailFromPicker.set(fromPicker);
    this.state.set('container_detail');
    this.refreshContainerDetail(container.id);
  }

  /** Scan of a shipment already inside a container/batch → show that container's detail */
  openContainerDetailFromScan(shipment: any): void {
    this.resultShipment.set(shipment);
    this.openContainerDetail({ id: shipment.container_id } as Container);
  }

  refreshContainerDetail(containerId: string): void {
    this.detailLoading.set(true);
    this.containerService.getContainer(containerId).subscribe({
      next: (response) => {
        if (response.success) {
          this.detailContainer.set(response.data.container);
          // Fetch distribution data for each shipment that is half_loaded
          const shipments = response.data.container?.shipments || [];
          shipments.forEach((shipment: any) => {
            if (shipment.status === 'half_loaded' || shipment.status === 'loading_container') {
              this.loadShipmentDistribution(shipment.id);
            }
          });
        }
        this.detailLoading.set(false);
      },
      error: (error: any) => {
        console.error('Failed to load container details:', error);
        this.detailLoading.set(false);
      }
    });
  }

  closeContainerDetail(): void {
    this.detailClosing.set(true);
    setTimeout(() => {
      this.detailClosing.set(false);
      this.detailContainer.set(null);
      this.shipmentDistributions.set({});
      if (this.detailFromPicker()) {
        // Opened from the picker — return to it without losing the load context,
        // refreshing the list in case the container changed (closed/advanced) in detail
        this.detailFromPicker.set(false);
        const shipment = this.loadShipment();
        if (shipment) {
          this.openContainerPicker(shipment);
        } else {
          this.state.set('container_picker');
        }
        return;
      }
      this.resetToIdle();
    }, 280);
  }

  loadShipmentDistribution(shipmentId: string): void {
    this.shipmentDistributions.update(dists => ({
      ...dists,
      [shipmentId]: { loading: true, error: null, data: null }
    }));
    this.shipmentService.getContainerStatus(shipmentId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.shipmentDistributions.update(dists => ({
            ...dists,
            [shipmentId]: { loading: false, error: null, data: response.data }
          }));
        } else {
          this.shipmentDistributions.update(dists => ({
            ...dists,
            [shipmentId]: { loading: false, error: 'Failed to load', data: null }
          }));
        }
      },
      error: () => {
        this.shipmentDistributions.update(dists => ({
          ...dists,
          [shipmentId]: { loading: false, error: 'Failed to load', data: null }
        }));
      }
    });
  }

  getShipmentDistribution(shipmentId: string): ShipmentDistributionState | null {
    return this.shipmentDistributions()[shipmentId] || null;
  }

  hasDetailShipments(): boolean {
    const container = this.detailContainer();
    return !!(container?.shipments && container.shipments.length > 0);
  }

  getDetailShipments(): any[] {
    const container = this.detailContainer();
    return container?.shipments || [];
  }

  /** Scan to Load: pre-select this container, then scan the shipment QR */
  scanToLoadInto(container: Container): void {
    this.selectedContainer.set(container);
    this.detailContainer.set(null);
    this.shipmentDistributions.set({});
    this.detailClosing.set(false);
    this.detailFromPicker.set(false);
    this.beginScanning();
  }

  /** Picker cancel with sheet close animation */
  closeContainerPicker(): void {
    this.pickerClosing.set(true);
    setTimeout(() => {
      this.pickerClosing.set(false);
      this.cancelLoadFlow();
    }, 280);
  }

  /** Load-quantity modal cancel with sheet close animation */
  closeLoadQuantityModal(): void {
    this.loadQuantityClosing.set(true);
    setTimeout(() => {
      this.loadQuantityClosing.set(false);
      this.cancelLoadFlow();
    }, 280);
  }

  resetToIdle(): void {
    this.scanHandled = false;
    this.resultShipment.set(null);
    this.infoMessage.set('');
    this.errorMessage.set('');
    this.cameraError.set(null);
    this.cameraErrorDetail.set(null);
    this.pendingQrUuid.set(null);
    this.expectedQuantity.set(null);
    this.receivedQuantity.set(null);
    this.quantityError.set('');
    this.partialReceiptData.set(null);
    this.addRemainingQuantity.set(null);
    this.addRemainingError.set('');
    this.loadShipment.set(null);
    this.loadableContainers.set([]);
    this.containersLoading.set(false);
    this.selectedContainer.set(null);
    this.loadQuantity.set(null);
    this.loadQuantityError.set('');
    this.containerStatusData.set(null);
    this.containerStatusLoading.set(false);
    this.containerStatusError.set(null);
    this.loadingShipment.set(false);
    this.newContainerRef.set('');
    this.creatingContainer.set(false);
    this.updatingContainer.set(null);
    this.detailContainer.set(null);
    this.detailLoading.set(false);
    this.shipmentDistributions.set({});
    this.pickerClosing.set(false);
    this.loadQuantityClosing.set(false);
    this.detailClosing.set(false);
    this.detailFromPicker.set(false);
    this.state.set('idle');
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  goToShipping(): void {
    this.router.navigate(['/account/shipping']);
  }
}
