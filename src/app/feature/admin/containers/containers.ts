import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

interface ContainerAgent {
  id?: number;
  uuid?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
}

interface ContainerItem {
  id: string;
  reference_number: string;
  status: string;
  created_at: string;
  agent?: ContainerAgent;
  shipments_count?: number;
}

interface ContainerShipment {
  id: string;
  tracking_number?: string;
  buyer_name?: string;
  expected_quantity?: number;
  loaded_quantity?: number;
  pivot_quantity?: number;
  pivot_status?: string;
  status?: string;
}

@Component({
  selector: 'app-admin-containers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './containers.html',
  styleUrl: './containers.css'
})
export class AdminContainers implements OnInit {
  containers = signal<ContainerItem[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(15);
  searchQuery = signal('');
  statusFilter = signal('');
  agentFilter = signal('');

  modalMode = signal<'none' | 'view' | 'status' | 'addShipment' | 'bulkStatus'>('none');
  selectedContainer = signal<ContainerItem | null>(null);
  containerShipments = signal<ContainerShipment[]>([]);

  newStatus = signal('');
  newShipmentId = signal('');
  newShipmentQuantity = signal<number | null>(null);
  availableShipments = signal<any[]>([]);
  loadingShipments = signal(false);

  selectedIds = signal<string[]>([]);

  readonly statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'closed', label: 'Closed' },
    { value: 'at_port_abroad', label: 'At Port Abroad' },
    { value: 'in_transit', label: 'In Transit' },
    { value: 'at_tanzania_port', label: 'At Tanzania Port' },
    { value: 'at_tanzania_warehouse', label: 'At Tanzania Warehouse' },
  ];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadContainers();
  }

  loadContainers(): void {
    this.loading.set(true);
    this.adminService.getContainers({
      page: this.currentPage(),
      per_page: this.perPage(),
      search: this.searchQuery() || undefined,
      status: this.statusFilter() || undefined,
      agent_id: this.agentFilter() || undefined,
    }).subscribe({
      next: (res: any) => {
        this.containers.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load containers');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadContainers();
  }

  onStatusChange(): void {
    this.currentPage.set(1);
    this.loadContainers();
  }

  onAgentFilterChange(): void {
    this.currentPage.set(1);
    this.loadContainers();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadContainers();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadContainers();
    }
  }

  getAgentName(container: ContainerItem): string {
    const agent = container.agent;
    if (!agent) return '-';
    const name = `${agent.firstname || ''} ${agent.lastname || ''}`.trim();
    return name || agent.email || '-';
  }

  statusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      closed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      at_port_abroad: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      in_transit: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      at_tanzania_port: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      at_tanzania_warehouse: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
    return classes[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }

  statusLabel(status: string): string {
    return this.statusOptions.find(s => s.value === status)?.label || status;
  }

  openView(container: ContainerItem): void {
    this.selectedContainer.set(container);
    this.modalMode.set('view');
    this.containerShipments.set([]);
    this.adminService.getContainer(container.id).subscribe({
      next: (res: any) => {
        this.containerShipments.set(res.shipments || []);
      },
      error: () => this.toastService.error('Failed to load container details')
    });
  }

  openStatusModal(container: ContainerItem): void {
    this.selectedContainer.set(container);
    this.newStatus.set(container.status);
    this.modalMode.set('status');
  }

  openAddShipmentModal(container: ContainerItem): void {
    this.selectedContainer.set(container);
    this.newShipmentId.set('');
    this.newShipmentQuantity.set(null);
    this.availableShipments.set([]);
    this.modalMode.set('addShipment');
    this.loadAvailableShipments();
  }

  openBulkStatusModal(): void {
    this.newStatus.set('');
    this.modalMode.set('bulkStatus');
  }

  closeModal(): void {
    this.modalMode.set('none');
    this.selectedContainer.set(null);
    this.containerShipments.set([]);
    this.availableShipments.set([]);
    this.newShipmentId.set('');
    this.newShipmentQuantity.set(null);
    this.newStatus.set('');
  }

  updateStatus(): void {
    const container = this.selectedContainer();
    const status = this.newStatus();
    if (!container || !status) return;

    this.adminService.updateContainerStatus(container.id, status).subscribe({
      next: () => {
        this.toastService.success('Container status updated');
        this.closeModal();
        this.loadContainers();
      },
      error: (err: any) => this.toastService.error(err?.error?.message || 'Failed to update status')
    });
  }

  addShipment(): void {
    const container = this.selectedContainer();
    const shipmentId = this.newShipmentId();
    const quantity = this.newShipmentQuantity();
    if (!container || !shipmentId) return;

    this.adminService.addShipmentToContainer(container.id, shipmentId, quantity ?? 1).subscribe({
      next: () => {
        this.toastService.success('Shipment added to container');
        this.closeModal();
        this.loadContainers();
      },
      error: (err: any) => this.toastService.error(err?.error?.message || 'Failed to add shipment')
    });
  }

  removeShipment(shipment: ContainerShipment): void {
    const container = this.selectedContainer();
    if (!container) return;
    if (!confirm(`Remove shipment ${shipment.tracking_number || shipment.id} from this container?`)) return;

    this.adminService.removeShipmentFromContainer(container.id, shipment.id).subscribe({
      next: () => {
        this.toastService.success('Shipment removed from container');
        this.openView(container);
        this.loadContainers();
      },
      error: (err: any) => this.toastService.error(err?.error?.message || 'Failed to remove shipment')
    });
  }

  closeContainer(container: ContainerItem): void {
    if (!confirm(`Close container ${container.reference_number}?`)) return;
    this.adminService.closeContainer(container.id).subscribe({
      next: () => {
        this.toastService.success('Container closed');
        this.loadContainers();
      },
      error: (err: any) => this.toastService.error(err?.error?.message || 'Failed to close container')
    });
  }

  deleteContainer(container: ContainerItem): void {
    if (!confirm(`Delete container ${container.reference_number}?`)) return;
    this.adminService.deleteContainer(container.id).subscribe({
      next: () => {
        this.toastService.success('Container deleted');
        this.loadContainers();
      },
      error: (err: any) => this.toastService.error(err?.error?.message || 'Failed to delete container')
    });
  }

  loadAvailableShipments(): void {
    this.loadingShipments.set(true);
    this.adminService.getShipments({ per_page: 100 }).subscribe({
      next: (res: any) => {
        this.availableShipments.set(res.data || []);
        this.loadingShipments.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load shipments');
        this.loadingShipments.set(false);
      }
    });
  }

  getShipmentDisplay(shipment: any): string {
    const name = `${shipment.user?.firstname || ''} ${shipment.user?.lastname || ''}`.trim();
    return `${shipment.tracking_number || shipment.id}${name ? ` - ${name}` : ''}`;
  }

  toggleSelect(id: string): void {
    this.selectedIds.update(ids => {
      if (ids.includes(id)) {
        return ids.filter(i => i !== id);
      }
      return [...ids, id];
    });
  }

  toggleSelectAll(): void {
    if (this.selectedIds().length === this.containers().length) {
      this.selectedIds.set([]);
    } else {
      this.selectedIds.set(this.containers().map(c => c.id));
    }
  }

  bulkUpdateStatus(): void {
    const ids = this.selectedIds();
    const status = this.newStatus();
    if (!ids.length || !status) {
      this.toastService.error('Please select containers and a status');
      return;
    }

    this.adminService.bulkUpdateContainerStatus(ids, status).subscribe({
      next: () => {
        this.toastService.success('Bulk status updated');
        this.selectedIds.set([]);
        this.closeModal();
        this.loadContainers();
      },
      error: (err: any) => this.toastService.error(err?.error?.message || 'Failed to bulk update status')
    });
  }
}
