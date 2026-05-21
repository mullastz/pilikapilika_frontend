import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';
import { ShipmentService } from '../../core/services/shipment.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

type ScanState = 'idle' | 'scanning' | 'processing' | 'success' | 'info' | 'error';

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

    this.html5QrCode = new Html5Qrcode('reader');

    try {
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10 },
        (decodedText) => {
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
    this.approveShipment(uuid);
  }

  extractUuid(text: string): string | null {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = text.match(uuidRegex);
    return match ? match[0] : null;
  }

  approveShipment(uuid: string): void {
    this.state.set('processing');
    this.shipmentService.approveByQrCode(uuid).subscribe({
      next: (response) => {
        if (response.success && response.info) {
          // Info: shipment found but already at some status
          this.resultShipment.set(response.data?.shipment ?? null);
          this.infoMessage.set(response.message);
          this.state.set('info');
          this.toastService.info(response.message);
        } else if (response.success) {
          // Success: shipment approved
          this.resultShipment.set(response.data?.shipment ?? null);
          this.state.set('success');
          this.toastService.success(response.message);
        } else {
          // API returned success:false — show as simple error
          this.state.set('error');
          this.errorMessage.set(response.message || 'Invalid QR code');
          this.toastService.error(response.message || 'Invalid QR code');
        }
      },
      error: (err: any) => {
        // Never expose raw error details to the user
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

  resetToIdle(): void {
    this.scanHandled = false;
    this.resultShipment.set(null);
    this.infoMessage.set('');
    this.errorMessage.set('');
    this.cameraError.set(null);
    this.cameraErrorDetail.set(null);
    this.state.set('idle');
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  goToShipping(): void {
    this.router.navigate(['/account/shipping']);
  }
}
