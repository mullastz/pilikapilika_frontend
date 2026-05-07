import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { PackageService } from '../../core/services/package.service';

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
  quantity: number;
  photos: string[] | null;
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

  constructor(
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
    private packageService: PackageService,
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
        this.packageData = res?.data?.package ?? null;
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

  calculateTotal(cost: string, quantity: number): number {
    console.log('[PackageView] calculateTotal called with:', { cost, quantity });
    console.log('[PackageView] Cost type:', typeof cost, 'Value:', cost);
    console.log('[PackageView] Quantity type:', typeof quantity, 'Value:', quantity);
    
    const costNum = parseFloat(cost);
    console.log('[PackageView] Parsed cost:', costNum, 'isNaN result:', isNaN(costNum));
    
    if (isNaN(costNum) || !quantity) {
      console.log('[PackageView] Invalid values - cost:', cost, 'quantity:', quantity);
      return 0;
    }
    
    const total = costNum * quantity;
    console.log('[PackageView] Calculated total:', total, 'isNaN result:', isNaN(total));
    return total;
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
