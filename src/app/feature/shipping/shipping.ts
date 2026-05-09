import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { ShipmentService, Shipment } from '../../core/services/shipment.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-shipping',
  imports: [ CommonModule ],
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

  constructor(
    private location: Location,
    private router: Router,
    private shipmentService: ShipmentService,
    private toastService: ToastService,
    private authService: AuthService
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
      this.loadUserShipments();
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

  // Confirmation methods
  confirmAction(shipment: Shipment, action: string, message: string): boolean {
    return confirm(`Are you sure you want to ${action} this shipment?`);
  }

  confirmShipmentAction(shipment: Shipment): void {
    if (!this.confirmAction(shipment, 'confirm', 'confirm this shipment request')) {
      return;
    }
    this.confirmShipment(shipment);
  }

  rejectShipmentAction(shipment: Shipment): void {
    if (!this.confirmAction(shipment, 'reject', 'reject this shipment request')) {
      return;
    }
    this.rejectShipment(shipment);
  }

  cancelShipmentAction(shipment: Shipment): void {
    if (!this.confirmAction(shipment, 'cancel', 'cancel this shipment')) {
      return;
    }
    this.cancelShipment(shipment);
  }

  markAsInTransitAction(shipment: Shipment): void {
    if (!this.confirmAction(shipment, 'mark as in transit', 'mark this shipment as in transit')) {
      return;
    }
    this.markAsInTransit(shipment);
  }

  markAsDeliveredAction(shipment: Shipment): void {
    if (!this.confirmAction(shipment, 'mark as delivered', 'mark this shipment as delivered')) {
      return;
    }
    this.markAsDelivered(shipment);
  }
} 
