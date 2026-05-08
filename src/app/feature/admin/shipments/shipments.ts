import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTable, TableColumn } from '../../../shared/data-table/data-table';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-shipments',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable],
  templateUrl: './shipments.html',
  styleUrl: './shipments.css'
})
export class AdminShipments implements OnInit {
  shipments = signal<any[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  searchQuery = signal('');
  modalMode = signal<'none' | 'view' | 'edit'>('none');
  selectedShipment = signal<any | null>(null);

  columns: TableColumn[] = [
    { key: 'uuid', label: 'UUID', format: (v) => v?.slice(0, 8) + '...' || '-' },
    { key: 'name', label: 'Package' },
    { key: 'user.firstname', label: 'Owner', format: (v, row) => `${row.user?.firstname || ''} ${row.user?.lastname || ''}`.trim() || '-' },
    { key: 'tracking_number', label: 'Tracking #' },
    { key: 'pickup_address', label: 'From', format: (v) => v || '-' },
    { key: 'destination_address', label: 'To', format: (v) => v || '-' },
    { key: 'created_at', label: 'Created', format: (v) => v ? new Date(v).toLocaleDateString() : '-' },
  ];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadShipments();
  }

  loadShipments(): void {
    this.loading.set(true);
    this.adminService.getShipments({
      page: this.currentPage(),
      search: this.searchQuery() || undefined,
    }).subscribe({
      next: (res: any) => {
        this.shipments.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load shipments');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadShipments();
  }

  onView(pkg: any): void {
    this.selectedShipment.set({ ...pkg });
    this.modalMode.set('view');
  }

  onEdit(pkg: any): void {
    this.selectedShipment.set({ ...pkg });
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set('none');
    this.selectedShipment.set(null);
  }

  saveShipmentEdit(): void {
    const pkg = this.selectedShipment();
    if (!pkg) return;
    const payload = {
      name: pkg.name,
      pickup_address: pkg.pickup_address,
      destination_address: pkg.destination_address,
    };
    this.adminService.updateShipment(pkg.uuid, payload).subscribe({
      next: () => {
        this.toastService.success('Shipment updated');
        this.closeModal();
        this.loadShipments();
      },
      error: () => this.toastService.error('Failed to update shipment')
    });
  }

  onDelete(pkg: any): void {
    if (!confirm(`Delete package ${pkg.name}?`)) return;
    this.adminService.deleteShipment(pkg.uuid).subscribe({
      next: () => {
        this.toastService.success('Package deleted');
        this.loadShipments();
      },
      error: () => this.toastService.error('Failed to delete package')
    });
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadShipments();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadShipments();
    }
  }
}
