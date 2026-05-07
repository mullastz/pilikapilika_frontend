import { Component, OnInit, ChangeDetectorRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { QrCodeService } from '../../core/services/qr-code.service';
import { QRCodeComponent } from 'angularx-qrcode';
import { environment } from '../../../environments/environment';

interface QrCodeData {
  uuid: string;
  product_name: string;
  product_cost: string;
  currency: string;
  description: string | null;
  category: string | null;
  package_type: string | null;
  quantity: number | null;
  total_weight: string | null;
  total_volume: string | null;
  product_value: string | null;
  product_id: string | null;
  supplier_name: string;
  supplier_phone: string;
  supplier_contact_person: string | null;
  supplier_pickup_address: string | null;
  photos: string[] | null;
  qr_data: string;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-qr-view',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './qr-view.html',
  styleUrl: './qr-view.css',
  schemas: [NO_ERRORS_SCHEMA]
})
export class QrView implements OnInit {
  qrData: QrCodeData | null = null;
  isLoading = true;
  errorMessage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private qrCodeService: QrCodeService,
    private location: Location,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (!uuid) {
      this.errorMessage = 'Invalid QR code link.';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.qrCodeService.getByUuid(uuid).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.qrData = res?.data ?? null;
        if (!this.qrData) {
          this.errorMessage = 'QR code details not found.';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err?.error?.message ?? 'Unable to load QR code details. Please try again later.';
        this.cdr.detectChanges();
      },
    });
  }

  goBack() {
    this.location.back();
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString();
  }

  downloadQR() {
    const canvas = document.querySelector('qrcode canvas') as HTMLCanvasElement;
    if (!canvas) {
      alert('QR code not ready for download.');
      return;
    }

    const link = document.createElement('a');
    link.download = `QR-${this.qrData?.uuid || 'product'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  shareQR() {
    const shareUrl = this.qrData?.qr_data || '';
    const shareText = `Product: ${this.qrData?.product_name}\nCost: ${this.qrData?.currency} ${this.qrData?.product_cost}\nSupplier: ${this.qrData?.supplier_name}\nPhone: ${this.qrData?.supplier_phone}\nView details: ${shareUrl}`;
    if (navigator.share) {
      navigator
        .share({
          title: 'Product QR Code',
          text: shareText,
          url: shareUrl,
        })
        .catch(() => {
          this.copyToClipboard();
        });
    } else {
      this.copyToClipboard();
    }
  }

  private copyToClipboard() {
    const text = this.qrData?.qr_data || '';
    navigator.clipboard.writeText(text).then(() => {
      alert('QR code link copied to clipboard!');
    });
  }

  sendToAgent() {
    if (!this.qrData) return;
    
    const productInfo = {
      product: {
        name: this.qrData.product_name,
        cost: this.qrData.product_cost,
        currency: this.qrData.currency,
        description: this.qrData.description,
        category: this.qrData.category,
        packageType: this.qrData.package_type,
        quantity: this.qrData.quantity,
        totalWeight: this.qrData.total_weight,
        totalVolume: this.qrData.total_volume,
        productValue: this.qrData.product_value,
        productId: this.qrData.product_id
      },
      supplier: {
        name: this.qrData.supplier_name,
        contactPerson: this.qrData.supplier_contact_person,
        phone: this.qrData.supplier_phone,
        pickupAddress: this.qrData.supplier_pickup_address
      },
      qrData: this.qrData.qr_data,
      qrUuid: this.qrData.uuid
    };
    
    this.router.navigate(['/messages'], {
      state: { productInfo }
    });
  }
}
