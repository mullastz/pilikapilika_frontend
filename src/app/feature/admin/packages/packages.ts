import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTable, TableColumn } from '../../../shared/data-table/data-table';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

type ModalMode = 'none' | 'view' | 'edit';

@Component({
  selector: 'app-admin-packages',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable],
  templateUrl: './packages.html',
})
export class AdminPackages implements OnInit {
  packages = signal<any[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  searchQuery = signal('');
  modalMode = signal<ModalMode>('none');
  selectedPackage = signal<any | null>(null);

  columns: TableColumn[] = [
    {
      key: 'uuid',
      label: 'UUID',
      format: (v) => v?.slice(0, 8) + '...' || '-'
    },
    {
      key: 'name',
      label: 'Name / Description',
      format: (v, row) => v || row.description?.slice(0, 40) || '-'
    },
    {
      key: 'user',
      label: 'Owner',
      format: (v, row) => `${row.user?.firstname || ''} ${row.user?.lastname || ''}`.trim() || row.user?.email || '-'
    },
    {
      key: 'tracking_number',
      label: 'Tracking #',
      format: (v) => v || '-'
    },
    {
      key: 'created_at',
      label: 'Created',
      format: (v) => v ? new Date(v).toLocaleDateString() : '-'
    },
  ];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadPackages();
  }

  loadPackages(): void {
    this.loading.set(true);
    this.adminService.getPackages({
      page: this.currentPage(),
      search: this.searchQuery() || undefined,
    }).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        this.packages.set(data || []);
        this.currentPage.set(res?.current_page || 1);
        this.lastPage.set(res?.last_page || 1);
        this.total.set(res?.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load packages');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadPackages();
  }

  onView(pkg: any): void {
    this.adminService.getPackage(pkg.uuid).subscribe({
      next: (res: any) => {
        this.selectedPackage.set(res || pkg);
        this.modalMode.set('view');
      },
      error: () => this.toastService.error('Failed to load package details')
    });
  }

  onEdit(pkg: any): void {
    this.selectedPackage.set({ ...pkg });
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set('none');
    this.selectedPackage.set(null);
  }

  savePackageEdit(): void {
    const pkg = this.selectedPackage();
    if (!pkg) return;
    const payload = {
      name: pkg.name,
      description: pkg.description,
      pickup_address: pkg.pickup_address,
      destination_address: pkg.destination_address,
      tracking_number: pkg.tracking_number,
    };
    this.adminService.updatePackage(pkg.uuid, payload).subscribe({
      next: () => {
        this.toastService.success('Package updated');
        this.closeModal();
        this.loadPackages();
      },
      error: () => this.toastService.error('Failed to update package')
    });
  }

  onDelete(pkg: any): void {
    if (!confirm(`Delete package ${pkg.name || pkg.uuid}?`)) return;
    this.adminService.deletePackage(pkg.uuid).subscribe({
      next: () => {
        this.toastService.success('Package deleted');
        this.loadPackages();
      },
      error: () => this.toastService.error('Failed to delete package')
    });
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadPackages();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadPackages();
    }
  }
}
