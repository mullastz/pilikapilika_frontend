import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { QrCodeService } from '../../core/services/qr-code.service';

interface QrCodeItem {
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
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-my-products',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-products.html',
  styleUrl: './my-products.css',
})
export class MyProducts implements OnInit {
  qrCodes: QrCodeItem[] = [];
  isLoading = true;
  errorMessage: string | null = null;
  showDeleteModal = false;
  deleteUuid: string | null = null;
  isDeleting = false;
  deleteStatus: 'idle' | 'success' | 'error' = 'idle';
  deleteMessage: string | null = null;

  constructor(
    private location: Location,
    public router: Router,
    private qrCodeService: QrCodeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.errorMessage = null;

    console.log('[MyProducts] Loading data...');
    
    // Load products
    this.qrCodeService.getAll().subscribe({
      next: (res: any) => {
        console.log('[MyProducts] QR codes response:', res);
        this.qrCodes = res?.data ?? [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[MyProducts] QR codes API error:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
        this.errorMessage =
          err?.error?.message ?? 'Unable to load your products. Please try again later.';
      },
    });
  }


  viewQrCode(uuid: string) {
    this.router.navigate(['/qr', uuid]);
  }

  editQrCode(uuid: string) {
    this.router.navigate(['/qr-generator'], { queryParams: { edit: uuid } });
  }

  deleteQrCode(uuid: string) {
    this.deleteUuid = uuid;
    this.showDeleteModal = true;
  }

  confirmDelete() {
    if (!this.deleteUuid) return;

    this.isDeleting = true;
    this.deleteStatus = 'idle';
    this.deleteMessage = null;
    this.cdr.detectChanges(); // Force immediate UI update

    this.qrCodeService.delete(this.deleteUuid).subscribe({
      next: () => {
        this.qrCodes = this.qrCodes.filter(qr => qr.uuid !== this.deleteUuid);
        this.deleteStatus = 'success';
        this.deleteMessage = 'Product deleted successfully!';
        this.isDeleting = false; // Also reset deleting state
        this.cdr.detectChanges(); // Force immediate UI update
        
        // Auto-close modal after success
        setTimeout(() => {
          this.closeDeleteModal();
        }, 2000);
      },
      error: (err) => {
        console.error('Delete failed:', err);
        this.deleteStatus = 'error';
        this.deleteMessage = 'Failed to delete product. Please try again.';
        this.isDeleting = false; // Also reset deleting state
        this.cdr.detectChanges(); // Force immediate UI update
        
        // Auto-close modal after error
        setTimeout(() => {
          this.closeDeleteModal();
        }, 3000);
      },
    });
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.deleteUuid = null;
    this.isDeleting = false;
    this.deleteStatus = 'idle';
    this.deleteMessage = null;
  }

  goBack() {
    this.location.back();
  }
}
