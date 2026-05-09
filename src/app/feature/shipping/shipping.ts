import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { ShipmentService, Shipment } from '../../core/services/shipment.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { QrCodeService } from '../../core/services/qr-code.service';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-shipping',
  imports: [ CommonModule, QRCodeComponent ],
  templateUrl: './shipping.html',
  styleUrl: './shipping.css',
})
export class Shipping implements OnInit {
  // Signals
  private _shipments = signal<Shipment[]>([]);
  private _activeTab = signal<string>('all');
  public loading = signal<boolean>(false);
  public error = signal<string | null>(null);
  public updatingShipment = signal<string | null>(null);

  // Confirmation modal state
  public confirmModalOpen = signal(false);
  public confirmModalConfig = signal<{
    title: string;
    message: string;
    action: 'confirm' | 'reject' | 'cancel' | 'in_transit' | 'delivered';
    shipment: Shipment | null;
  }>({ title: '', message: '', action: 'confirm', shipment: null });

  // View details modal state
  public viewModalOpen = signal(false);
  public viewModalLoading = signal(false);
  public viewModalError = signal<string | null>(null);
  public selectedShipmentDetail = signal<Shipment | null>(null);

  // Product expand state for view modal
  public selectedProductUuid = signal<string | null>(null);
  public productDetailsMap = signal<Map<string, any>>(new Map());

  // Computed signals
  public shipments = computed(() => this._shipments());
  public activeTab = computed(() => this._activeTab());
  public isAgent = computed(() => {
    const user = this.authService.getUser();
    // Treat 'Seller' role as agent since that's how agents are stored in system
    const role = user?.role?.toLowerCase();
    return role === 'agent' || role === 'seller';
  });

  // Tab configuration for agents
  agentTabs = [
    { id: 'all', label: 'All Shipments', icon: 'fa-list' },
    { id: 'pending_confirmation', label: 'Requests', icon: 'fa-clock' },
    { id: 'confirmed', label: 'Confirmed', icon: 'fa-check-circle' },
    { id: 'in_transit', label: 'In Transit', icon: 'fa-truck' },
    { id: 'delivered', label: 'Delivered', icon: 'fa-check-double' },
    { id: 'cancelled', label: 'Cancelled', icon: 'fa-times-circle' },
    { id: 'my_shippings', label: 'My Shippings', icon: 'fa-box' }
  ];

  // Tab configuration for normal users
  userTabs = [
    { id: 'all', label: 'All Shipments', icon: 'fa-list' },
    { id: 'pending_confirmation', label: 'Pending', icon: 'fa-clock' },
    { id: 'confirmed', label: 'Confirmed', icon: 'fa-check-circle' },
    { id: 'in_transit', label: 'In Transit', icon: 'fa-truck' },
    { id: 'delivered', label: 'Delivered', icon: 'fa-check-double' },
    { id: 'cancelled', label: 'Cancelled', icon: 'fa-times-circle' }
  ];

  constructor(
    private location: Location,
    private router: Router,
    private shipmentService: ShipmentService,
    private toastService: ToastService,
    private authService: AuthService,
    private qrCodeService: QrCodeService
  ) {}

  ngOnInit(): void {
    this.loadShipments();
  }

  goBack(): void {
    this.location.back();
  }

  switchTab(tabId: string): void {
    this._activeTab.set(tabId);
    this.loadShipments();
  }

  private loadShipments(): void {
    this.loading.set(true);
    this.error.set(null);

    const currentTab = this.activeTab();
    const isAgentUser = this.isAgent();
    
    if (isAgentUser) {
      // Agent-specific loading
      if (currentTab === 'all') {
        this.loadAgentShipments();
      } else if (currentTab === 'my_shippings') {
        this.loadUserShipments(); // Load shipments agent booked to other agents
      } else if (currentTab === 'cancelled') {
        this.loadCancelledShipments();
      } else {
        this.loadAgentShipmentsByStatus(currentTab);
      }
    } else {
      // Normal user loading
      if (currentTab === 'all') {
        this.loadUserShipments();
      } else {
        this.loadUserShipmentsByStatus(currentTab);
      }
    }
  }

  private loadUserShipments(): void {
    this.shipmentService.getUserShipments().subscribe({
      next: (response) => {
        if (response.success) {
          this._shipments.set(response.data.shipments);
        } else {
          this.toastService.error('Failed to load shipments');
        }
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Failed to load shipments:', error);
        this.error.set('Failed to load shipments');
        this.toastService.error('Failed to load shipments');
        this.loading.set(false);
      }
    });
  }

  private loadUserShipmentsByStatus(status: string): void {
    this.shipmentService.getUserShipmentsByStatus(status).subscribe({
      next: (response) => {
        if (response.success) {
          // Filter shipments by status client-side
          const filteredShipments = status === 'all' 
            ? response.data.shipments 
            : response.data.shipments.filter(shipment => shipment.status === status);
          this._shipments.set(filteredShipments);
        } else {
          this.error.set('Failed to load shipments');
        }
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Failed to load user shipments by status:', error);
        this.error.set('Failed to load shipments');
        this.loading.set(false);
      }
    });
  }

  private loadAgentShipments(): void {
    this.shipmentService.getAgentShipments().subscribe({
      next: (response) => {
        if (response.success) {
          this._shipments.set(response.data.shipments);
        } else {
          this.toastService.error('Failed to load shipments');
        }
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Failed to load shipments:', error);
        this.error.set('Failed to load shipments');
        this.toastService.error('Failed to load shipments');
        this.loading.set(false);
      }
    });
  }

  private loadAgentShipmentsByStatus(status: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.shipmentService.getAgentShipmentsByStatus(status).subscribe({
      next: (response) => {
        if (response.success) {
          this._shipments.set(response.data.shipments);
        } else {
          this.error.set('Failed to load shipments');
        }
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Failed to load agent shipments by status:', error);
        this.error.set('Failed to load shipments');
        this.loading.set(false);
      }
    });
  }

  private loadCancelledShipments(): void {
    this.loading.set(true);
    this.error.set(null);

    // Load cancelled shipments only
    this.shipmentService.getAgentShipmentsByStatus('cancelled').subscribe({
      next: (response) => {
        if (response.success) {
          this._shipments.set(response.data.shipments);
        } else {
          this.error.set('Failed to load cancelled shipments');
        }
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Failed to load cancelled shipments:', error);
        this.error.set('Failed to load shipments');
        this.loading.set(false);
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-600';
      case 'in_transit':
        return 'bg-blue-100 text-blue-600';
      case 'confirmed':
        return 'bg-purple-100 text-purple-600';
      case 'pending_confirmation':
        return 'bg-yellow-100 text-yellow-600';
      case 'cancelled':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-gray-200 text-gray-600';
    }
  }

  formatStatus(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  trackShipment(shipment: Shipment): void {
    this.router.navigate(['/track-shipping', shipment.id]);
  }

  refreshShipments(): void {
    this.loadShipments();
  }

  // View details modal methods
  openViewModal(shipment: Shipment): void {
    this.viewModalOpen.set(true);
    this.viewModalLoading.set(true);
    this.viewModalError.set(null);
    this.selectedShipmentDetail.set(null);
    this.selectedProductUuid.set(null);
    this.productDetailsMap.set(new Map());

    this.shipmentService.getShipment(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.selectedShipmentDetail.set(response.data.shipment);
        } else {
          this.viewModalError.set('Failed to load shipment details');
        }
        this.viewModalLoading.set(false);
      },
      error: (error: any) => {
        console.error('Failed to load shipment details:', error);
        this.viewModalError.set('Failed to load shipment details');
        this.viewModalLoading.set(false);
      }
    });
  }

  closeViewModal(): void {
    this.viewModalOpen.set(false);
    this.viewModalLoading.set(false);
    this.viewModalError.set(null);
    this.selectedShipmentDetail.set(null);
    this.selectedProductUuid.set(null);
    this.productDetailsMap.set(new Map());
  }

  selectProduct(productId: string): void {
    if (this.selectedProductUuid() === productId) {
      this.selectedProductUuid.set(null);
      return;
    }
    this.selectedProductUuid.set(productId);

    const currentMap = this.productDetailsMap();
    if (!currentMap.has(productId)) {
      this.qrCodeService.getByUuid(productId).subscribe({
        next: (res: any) => {
          const fullData = res?.data ?? null;
          if (fullData) {
            const newMap = new Map(currentMap);
            newMap.set(productId, fullData);
            this.productDetailsMap.set(newMap);
          }
        },
        error: (err) => {
          console.warn('[Shipping] Failed to fetch product details for', productId, err);
        }
      });
    }
  }

  getFullProduct(product: any): any {
    const full = this.productDetailsMap().get(product.id);
    return full ? { ...product, ...full } : product;
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Agent-specific methods
  confirmShipment(shipment: Shipment): void {
    this.updatingShipment.set(shipment.id);

    this.shipmentService.confirmShipment(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Shipment confirmed successfully');
          this.loadShipments(); // Reload to update the list
        } else {
          this.toastService.error(response.message || 'Failed to confirm shipment');
        }
        this.updatingShipment.set(null);
      },
      error: (error: any) => {
        console.error('Failed to confirm shipment:', error);
        this.toastService.error('Failed to confirm shipment');
        this.updatingShipment.set(null);
      }
    });
  }

  markAsInTransit(shipment: Shipment): void {
    this.updatingShipment.set(shipment.id);

    this.shipmentService.markAsInTransit(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Shipment marked as in transit');
          this.loadShipments(); // Reload to update the list
        } else {
          this.toastService.error(response.message || 'Failed to update shipment');
        }
        this.updatingShipment.set(null);
      },
      error: (error: any) => {
        console.error('Failed to update shipment:', error);
        this.toastService.error('Failed to update shipment');
        this.updatingShipment.set(null);
      }
    });
  }

  markAsDelivered(shipment: Shipment): void {
    this.updatingShipment.set(shipment.id);

    this.shipmentService.markAsDelivered(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Shipment marked as delivered');
          this.loadShipments(); // Reload to update the list
        } else {
          this.toastService.error(response.message || 'Failed to update shipment');
        }
        this.updatingShipment.set(null);
      },
      error: (error: any) => {
        console.error('Failed to update shipment:', error);
        this.toastService.error('Failed to update shipment');
        this.updatingShipment.set(null);
      }
    });
  }

  canConfirm(shipment: Shipment): boolean {
    return shipment.status === 'pending_confirmation';
  }

  canMarkInTransit(shipment: Shipment): boolean {
    return shipment.status === 'confirmed';
  }

  canMarkDelivered(shipment: Shipment): boolean {
    return shipment.status === 'in_transit';
  }

  isUpdating(shipmentId: string): boolean {
    return this.updatingShipment() === shipmentId;
  }

  // Agent reject shipment
  rejectShipment(shipment: Shipment): void {
    this.updatingShipment.set(shipment.id);

    this.shipmentService.rejectShipment(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Shipment rejected successfully');
          this.loadShipments(); // Reload to update the list
        } else {
          this.toastService.error(response.message || 'Failed to reject shipment');
        }
        this.updatingShipment.set(null);
      },
      error: (error: any) => {
        console.error('Failed to reject shipment:', error);
        this.toastService.error('Failed to reject shipment');
        this.updatingShipment.set(null);
      }
    });
  }

  // Cancel shipment (for both agents and customers)
  cancelShipment(shipment: Shipment): void {
    this.updatingShipment.set(shipment.id);

    this.shipmentService.cancelShipment(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Shipment cancelled successfully');
          this.loadShipments(); // Reload to update the list
        } else {
          this.toastService.error(response.message || 'Failed to cancel shipment');
        }
        this.updatingShipment.set(null);
      },
      error: (error: any) => {
        console.error('Failed to cancel shipment:', error);
        this.toastService.error('Failed to cancel shipment');
        this.updatingShipment.set(null);
      }
    });
  }

  canCancel(shipment: Shipment): boolean {
    return shipment.status !== 'delivered' && shipment.status !== 'cancelled';
  }

  // Confirmation modal methods
  openConfirmModal(
    shipment: Shipment,
    action: 'confirm' | 'reject' | 'cancel' | 'in_transit' | 'delivered'
  ): void {
    const configMap: Record<typeof action, { title: string; message: string }> = {
      confirm: { title: 'Confirm Shipment', message: 'Are you sure you want to confirm this shipment request?' },
      reject: { title: 'Reject Shipment', message: 'Are you sure you want to reject this shipment request?' },
      cancel: { title: 'Cancel Shipment', message: 'Are you sure you want to cancel this shipment?' },
      in_transit: { title: 'Mark as In Transit', message: 'Are you sure you want to mark this shipment as in transit?' },
      delivered: { title: 'Mark as Delivered', message: 'Are you sure you want to mark this shipment as delivered?' },
    };
    const cfg = configMap[action];
    this.confirmModalConfig.set({ ...cfg, action, shipment });
    this.confirmModalOpen.set(true);
  }

  closeConfirmModal(): void {
    this.confirmModalOpen.set(false);
    this.confirmModalConfig.set({ title: '', message: '', action: 'confirm', shipment: null });
  }

  executeConfirmedAction(): void {
    const cfg = this.confirmModalConfig();
    if (!cfg.shipment) return;

    switch (cfg.action) {
      case 'confirm':
        this.confirmShipment(cfg.shipment);
        break;
      case 'reject':
        this.rejectShipment(cfg.shipment);
        break;
      case 'cancel':
        this.cancelShipment(cfg.shipment);
        break;
      case 'in_transit':
        this.markAsInTransit(cfg.shipment);
        break;
      case 'delivered':
        this.markAsDelivered(cfg.shipment);
        break;
    }
    this.closeConfirmModal();
  }

  // Action wrappers that open the confirmation modal
  confirmShipmentAction(shipment: Shipment): void {
    this.openConfirmModal(shipment, 'confirm');
  }

  rejectShipmentAction(shipment: Shipment): void {
    this.openConfirmModal(shipment, 'reject');
  }

  cancelShipmentAction(shipment: Shipment): void {
    this.openConfirmModal(shipment, 'cancel');
  }

  markAsInTransitAction(shipment: Shipment): void {
    this.openConfirmModal(shipment, 'in_transit');
  }

  markAsDeliveredAction(shipment: Shipment): void {
    this.openConfirmModal(shipment, 'delivered');
  }
} 
