import { Component, OnInit, ChangeDetectorRef, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { QrCodeService } from '../../core/services/qr-code.service';

interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

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
  @ViewChildren('productCard') productCards!: QueryList<ElementRef>;

  qrCodes: QrCodeItem[] = [];
  isLoading = true;
  errorMessage: string | null = null;
  showDeleteModal = false;
  deleteUuid: string | null = null;
  isDeleting = false;
  deleteStatus: 'idle' | 'success' | 'error' = 'idle';
  deleteMessage: string | null = null;
  highlightedUuid: string | null = null;

  // Pagination
  page = 1;
  perPage = 10;
  pagination: Pagination | null = null;

  constructor(
    private location: Location,
    public router: Router,
    private route: ActivatedRoute,
    private qrCodeService: QrCodeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.highlightedUuid = params['highlight'] || null;
    });
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.errorMessage = null;

    console.log('[MyProducts] Loading data... page:', this.page);

    this.qrCodeService.getAll(this.page, this.perPage).subscribe({
      next: (res: any) => {
        console.log('[MyProducts] QR codes response:', res);
        const qrCodes = res?.data?.qr_codes ?? res?.data ?? [];
        this.qrCodes = Array.isArray(qrCodes) ? qrCodes : [];
        this.pagination = res?.data?.pagination ?? null;
        this.isLoading = false;
        this.cdr.detectChanges();

        // Scroll to top on page change
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Scroll to highlighted product after render
        if (this.highlightedUuid) {
          setTimeout(() => this.scrollToHighlighted(), 300);
        }
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

  goToPage(newPage: number): void {
    if (!this.pagination) return;
    if (newPage < 1 || newPage > this.pagination.last_page) return;
    this.page = newPage;
    this.loadData();
  }

  get pages(): number[] {
    if (!this.pagination) return [];
    const total = this.pagination.last_page;
    const current = this.pagination.current_page;
    const delta = 2;
    const range: number[] = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) range.unshift(-1);
    if (current + delta < total - 1) range.push(-1);

    if (total > 1) {
      if (range[0] !== 1) range.unshift(1);
      if (range[range.length - 1] !== total) range.push(total);
    }

    return range;
  }

  scrollToHighlighted(): void {
    const index = this.qrCodes.findIndex(qr => qr.uuid === this.highlightedUuid);
    if (index === -1) return;

    const cards = this.productCards?.toArray();
    if (!cards || !cards[index]) return;

    const element = cards[index].nativeElement;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Auto-clear the highlight after 3 seconds so the ring disappears
    setTimeout(() => {
      this.highlightedUuid = null;
      this.cdr.detectChanges();
    }, 3000);
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
