import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { PackageService } from '../../core/services/package.service';
import { QrCodeService } from '../../core/services/qr-code.service';

interface PackageDetails {
  uuid: string;
  name: string;
  description: string | null;
  pickup_address: string | null;
  destination_address: string | null;
  tracking_number: string | null;
  photos: string[] | null;
  qr_data: string | null;
  total_value: string | null;
  currency: string | null;
  package_type: string | null;
  products: PackageProduct[] | null;
  created_at: string;
  updated_at: string;
}

interface PackageProduct {
  uuid: string;
  product_name: string;
  product_cost: string;
  currency: string;
  photos: string[] | null;
  description?: string | null;
  category?: string | null;
  package_type?: string | null;
  total_weight?: string | null;
  total_volume?: string | null;
  product_value?: string | null;
  product_id?: string | null;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  supplier_contact_person?: string | null;
  supplier_pickup_address?: string | null;
}

@Component({
  selector: 'app-package-view',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './package-view.html',
  styleUrl: './package-view.css',
})
export class PackageView implements OnInit {
  packageData: PackageDetails | null = null;
  isLoading = true;
  errorMessage: string | null = null;
  packageUuid: string | null = null;
  selectedProductUuid: string | null = null;
  productDetailsMap = new Map<string, any>();

  constructor(
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
    private packageService: PackageService,
    private qrCodeService: QrCodeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.packageUuid = this.route.snapshot.paramMap.get('uuid');
    if (this.packageUuid) {
      this.loadPackageDetails();
    } else {
      this.errorMessage = 'Package ID not found';
      this.isLoading = false;
    }
  }

  loadPackageDetails() {
    if (!this.packageUuid) return;

    this.isLoading = true;
    this.errorMessage = null;

    this.packageService.getByUuid(this.packageUuid).subscribe({
      next: (res: any) => {
        console.log('[PackageView] Package response:', res);
        const pkg = res?.data?.package ?? null;
        this.packageData = pkg ? { ...pkg, products: res?.data?.products ?? null } : null;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[PackageView] Package API error:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
        this.errorMessage =
          err?.error?.message ?? 'Unable to load package details. Please try again later.';
      },
    });
  }

  downloadQR() {
    if (!this.packageData?.qr_data) return;
    
    const qrElement = document.querySelector('qrcode canvas') as HTMLCanvasElement;
    if (!qrElement) return;

    const link = document.createElement('a');
    link.download = `Package-${this.packageData.uuid}.png`;
    link.href = qrElement.toDataURL('image/png');
    link.click();
  }

  shareQR() {
    const shareUrl = this.packageData?.qr_data || '';
    const shareText = `Package: ${this.packageData?.name}\nProducts: ${this.packageData?.products?.length || 0}\nView details: ${shareUrl}`;
    if (navigator.share) {
      navigator
        .share({
          title: 'Package QR Code',
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
    const text = this.packageData?.qr_data || '';
    navigator.clipboard.writeText(text).then(() => {
      alert('Package QR code link copied to clipboard!');
    });
  }

  sendToAgent() {
    this.router.navigate(['/messages'], {
      state: {
        packageInfo: {
          package: this.packageData,
          qrData: this.packageData?.qr_data,
          packageUuid: this.packageData?.uuid,
        },
      },
    });
  }

  goBack() {
    this.location.back();
  }

  selectProduct(uuid: string) {
    if (this.selectedProductUuid === uuid) {
      this.selectedProductUuid = null;
      return;
    }
    this.selectedProductUuid = uuid;

    // Fetch full product details if not already cached (same endpoint qr-view uses)
    if (!this.productDetailsMap.has(uuid)) {
      this.qrCodeService.getByUuid(uuid).subscribe({
        next: (res: any) => {
          const fullData = res?.data ?? null;
          if (fullData) {
            this.productDetailsMap.set(uuid, fullData);
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          console.warn('[PackageView] Failed to fetch product details for', uuid, err);
        },
      });
    }

    this.cdr.detectChanges();
    setTimeout(() => {
      const el = document.getElementById('product-' + uuid);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  getFullProduct(product: PackageProduct): any {
    const full = this.productDetailsMap.get(product.uuid);
    return full ? { ...product, ...full } : product;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
