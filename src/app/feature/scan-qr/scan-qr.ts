import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';
import { ShipmentService } from '../../core/services/shipment.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

type ScanState = 'idle' | 'scanning' | 'quantity_input' | 'partial_confirm' | 'add_remaining' | 'processing' | 'success' | 'info' | 'error';

@Component({
  selector: 'app-scan-qr',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scan-qr.html',
  styleUrl: './scan-qr.css'
})
export class ScanQr implements OnInit, OnDestroy {
  private router = inject(Router);
  private shipmentService = inject(ShipmentService);
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
            this.showQuantityInput(shipment, uuid);
          } else if (status === 'partially_received') {
            // Re-scanning a partially received shipment — show add remaining modal
            this.showAddRemainingModal(shipment);
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
  showQuantityInput(shipment: any, uuid: string): void {
    this.pendingQrUuid.set(uuid);
    // Extract expected quantity from products
    let qty: number | null = null;
    const products = shipment?.products ?? [];
    if (Array.isArray(products) && products.length > 0) {
      const firstProduct = products[0];
      if (firstProduct && typeof firstProduct.quantity === 'number') {
        qty = firstProduct.quantity;
      }
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
    if (qty === null || qty === undefined || qty < 0 || isNaN(qty)) {
      this.quantityError.set('Please enter a valid quantity (0 or more)');
      return;
    }

    const expected = this.expectedQuantity();
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

  private getExpectedQuantityFromShipment(shipment: any): number {
    const products = shipment?.products ?? [];
    if (Array.isArray(products) && products.length > 0) {
      const first = products[0];
      if (first && typeof first.quantity === 'number') {
        return first.quantity;
      }
      if (Array.isArray(first) && first.length > 0 && typeof first[0]?.quantity === 'number') {
        return first[0].quantity;
      }
    }
    return 1;
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
    this.state.set('idle');
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  goToShipping(): void {
    this.router.navigate(['/account/shipping']);
  }
}
