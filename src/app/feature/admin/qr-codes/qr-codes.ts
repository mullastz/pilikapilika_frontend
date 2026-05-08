import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTable, TableColumn } from '../../../shared/data-table/data-table';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-qr-codes',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable],
  templateUrl: './qr-codes.html',
  styleUrl: './qr-codes.css'
})
export class AdminQrCodes implements OnInit {
  qrCodes = signal<any[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  searchQuery = signal('');
  modalMode = signal<'none' | 'view' | 'edit'>('none');
  selectedQr = signal<any | null>(null);

  columns: TableColumn[] = [
    { key: 'uuid', label: 'UUID', format: (v) => v?.slice(0, 8) + '...' || '-' },
    { key: 'product_name', label: 'Product' },
    { key: 'user.firstname', label: 'Owner', format: (v, row) => `${row.user?.firstname || ''} ${row.user?.lastname || ''}`.trim() || '-' },
    { key: 'category', label: 'Category' },
    { key: 'product_cost', label: 'Cost', format: (v) => v ? v + ' TZS' : '-' },
    { key: 'quantity', label: 'Qty' },
    { key: 'created_at', label: 'Created', format: (v) => v ? new Date(v).toLocaleDateString() : '-' },
  ];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadQrCodes();
  }

  loadQrCodes(): void {
    this.loading.set(true);
    this.adminService.getQrCodes({
      page: this.currentPage(),
      search: this.searchQuery() || undefined,
    }).subscribe({
      next: (res: any) => {
        this.qrCodes.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load QR codes');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadQrCodes();
  }

  onView(qr: any): void {
    this.selectedQr.set({ ...qr });
    this.modalMode.set('view');
  }

  onEdit(qr: any): void {
    this.selectedQr.set({ ...qr });
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set('none');
    this.selectedQr.set(null);
  }

  saveQrEdit(): void {
    const qr = this.selectedQr();
    if (!qr) return;
    const payload = {
      product_name: qr.product_name,
      product_cost: qr.product_cost,
      category: qr.category,
      description: qr.description,
      quantity: qr.quantity,
    };
    this.adminService.updateQrCode(qr.uuid, payload).subscribe({
      next: () => {
        this.toastService.success('QR code updated');
        this.closeModal();
        this.loadQrCodes();
      },
      error: () => this.toastService.error('Failed to update QR code')
    });
  }

  onDelete(qr: any): void {
    if (!confirm(`Delete QR code for ${qr.product_name}?`)) return;
    this.adminService.deleteQrCode(qr.uuid).subscribe({
      next: () => {
        this.toastService.success('QR code deleted');
        this.loadQrCodes();
      },
      error: () => this.toastService.error('Failed to delete QR code')
    });
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadQrCodes();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadQrCodes();
    }
  }
}
