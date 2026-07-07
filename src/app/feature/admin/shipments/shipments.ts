import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableColumn } from '../../../shared/data-table/data-table';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

type ModalMode = 'none' | 'view' | 'edit' | 'status' | 'bulkStatus';

@Component({
  selector: 'app-admin-shipments',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  statusFilter = signal('');
  agentFilter = signal('');
  modalMode = signal<ModalMode>('none');
  selectedShipment = signal<any | null>(null);
  selectedStatus = signal('');
  selectedIds = signal<string[]>([]);
  selectedAgent = signal<any | null>(null);
  agents = signal<any[]>([]);

  statuses: string[] = [
    'pending_confirmation',
    'confirmed',
    'partially_received',
    'at_warehouse',
    'half_loaded',
    'loading_container',
    'loaded_in_container',
    'at_port_abroad',
    'in_transit',
    'at_tanzania_port',
    'at_tanzania_warehouse',
    'delivered',
    'cancelled',
  ];

  columns: TableColumn[] = [
    {
      key: 'tracking_number',
      label: 'Tracking #',
      format: (v) => v || '-'
    },
    {
      key: 'user',
      label: 'Buyer',
      format: (v, row) => `${row.user?.firstname || ''} ${row.user?.lastname || ''}`.trim() || row.user?.email || '-'
    },
    {
      key: 'agent',
      label: 'Agent',
      format: (v, row) => `${row.agent?.firstname || ''} ${row.agent?.lastname || ''}`.trim() || row.agent?.email || '-'
    },
    {
      key: 'status',
      label: 'Status',
      badge: (v) => ({ text: this.formatStatus(v), class: this.statusBadgeClass(v) })
    },
    {
      key: 'actual_price',
      label: 'Price',
      format: (v, row) => v ? `$${Number(v).toFixed(2)}` : (row.estimated_price ? `$${Number(row.estimated_price).toFixed(2)}` : '-')
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
    this.loadAgents();
    this.loadShipments();
  }

  loadAgents(): void {
    this.adminService.getAgents({ per_page: 1000 }).subscribe({
      next: (res: any) => {
        this.agents.set(res?.data || res || []);
      },
      error: () => this.toastService.error('Failed to load agents')
    });
  }

  loadShipments(): void {
    this.loading.set(true);
    const params: any = { page: this.currentPage() };
    if (this.searchQuery()) params.search = this.searchQuery();
    if (this.statusFilter()) params.status = this.statusFilter();
    if (this.agentFilter()) params.agent_id = this.agentFilter();

    this.adminService.getShipments(params).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        this.shipments.set(data || []);
        this.currentPage.set(res?.current_page || 1);
        this.lastPage.set(res?.last_page || 1);
        this.total.set(res?.total || 0);
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

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadShipments();
  }

  onView(shipment: any): void {
    this.adminService.getShipment(shipment.id).subscribe({
      next: (res: any) => {
        this.selectedShipment.set(res?.shipment || res || shipment);
        this.modalMode.set('view');
      },
      error: () => this.toastService.error('Failed to load shipment details')
    });
  }

  onEdit(shipment: any): void {
    this.selectedShipment.set({ ...shipment });
    this.modalMode.set('edit');
  }

  onUpdateStatus(shipment: any): void {
    this.selectedShipment.set({ ...shipment });
    this.selectedStatus.set(shipment.status);
    this.modalMode.set('status');
  }

  openBulkStatus(): void {
    if (this.selectedIds().length === 0) {
      this.toastService.error('Select at least one shipment');
      return;
    }
    this.selectedStatus.set('');
    this.modalMode.set('bulkStatus');
  }

  toggleSelection(id: string): void {
    this.selectedIds.update(ids => {
      if (ids.includes(id)) return ids.filter(i => i !== id);
      return [...ids, id];
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggleAll(): void {
    const allIds = this.shipments().map(s => s.id);
    if (this.selectedIds().length === allIds.length) {
      this.selectedIds.set([]);
    } else {
      this.selectedIds.set([...allIds]);
    }
  }

  closeModal(): void {
    this.modalMode.set('none');
    this.selectedShipment.set(null);
    this.selectedStatus.set('');
    this.selectedAgent.set(null);
  }

  saveShipmentEdit(): void {
    const shipment = this.selectedShipment();
    if (!shipment) return;
    const payload = {
      actual_price: shipment.actual_price,
      tracking_number: shipment.tracking_number,
      external_tracking_number: shipment.external_tracking_number,
      admin_note: shipment.admin_note,
    };
    this.adminService.updateShipment(shipment.id, payload).subscribe({
      next: () => {
        this.toastService.success('Shipment updated');
        this.closeModal();
        this.loadShipments();
      },
      error: () => this.toastService.error('Failed to update shipment')
    });
  }

  saveStatusUpdate(): void {
    const shipment = this.selectedShipment();
    if (!shipment || !this.selectedStatus()) return;
    this.adminService.updateShipmentStatus(shipment.id, this.selectedStatus()).subscribe({
      next: () => {
        this.toastService.success('Status updated');
        this.closeModal();
        this.loadShipments();
      },
      error: (err: any) => {
        const msg = err?.error?.message || 'Failed to update status';
        this.toastService.error(msg);
      }
    });
  }

  saveBulkStatusUpdate(): void {
    if (!this.selectedStatus() || this.selectedIds().length === 0) return;
    this.adminService.bulkUpdateShipmentStatus(this.selectedIds(), this.selectedStatus()).subscribe({
      next: () => {
        this.toastService.success('Bulk status updated');
        this.selectedIds.set([]);
        this.closeModal();
        this.loadShipments();
      },
      error: (err: any) => {
        const msg = err?.error?.message || 'Failed to update statuses';
        this.toastService.error(msg);
      }
    });
  }

  onDelete(shipment: any): void {
    if (!confirm(`Delete shipment ${shipment.tracking_number || shipment.id}?`)) return;
    this.adminService.deleteShipment(shipment.id).subscribe({
      next: () => {
        this.toastService.success('Shipment deleted');
        this.selectedIds.update(ids => ids.filter(id => id !== shipment.id));
        this.loadShipments();
      },
      error: () => this.toastService.error('Failed to delete shipment')
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

  formatStatus(status: string): string {
    if (!status) return '-';
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'pending_confirmation': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'confirmed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'partially_received': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'at_warehouse': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'in_transit': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'at_port_abroad':
      case 'at_tanzania_port':
      case 'at_tanzania_warehouse': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  }

  totalExpectedQuantity(shipment: any): number {
    const products = shipment?.products;
    if (!products) return 1;
    const arr = Array.isArray(products) ? products : (JSON.parse(products) || []);
    if (!Array.isArray(arr) || arr.length === 0) return 1;
    let first = arr[0];
    if (Array.isArray(first) && first.length > 0) first = first[0];
    return first?.quantity ? Number(first.quantity) : 1;
  }

  productsArray(shipment: any): any[] {
    const products = shipment?.products;
    if (!products) return [];
    const arr = Array.isArray(products) ? products : (JSON.parse(products) || []);
    return Array.isArray(arr) ? arr : [];
  }

  packagesArray(shipment: any): any[] {
    const packages = shipment?.packages;
    if (!packages) return [];
    const arr = Array.isArray(packages) ? packages : (JSON.parse(packages) || []);
    return Array.isArray(arr) ? arr : [];
  }

  getCellValue(col: TableColumn, row: any): string {
    const value = col.key.split('.').reduce((o, p) => o?.[p], row);
    if (col.format) {
      return col.format(value, row);
    }
    return value !== null && value !== undefined ? String(value) : '-';
  }

  getBadge(col: TableColumn, row: any) {
    if (!col.badge) return null;
    const value = col.key.split('.').reduce((o, p) => o?.[p], row);
    return col.badge(value, row);
  }
}
