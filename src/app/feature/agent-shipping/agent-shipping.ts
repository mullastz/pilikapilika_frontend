import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { ShipmentService, Shipment } from '../../core/services/shipment.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-agent-shipping',
  imports: [ CommonModule ],
  templateUrl: './agent-shipping.html',
  styleUrl: './agent-shipping.css',
})
export class AgentShipping implements OnInit {
  // Signals
  private _shipments = signal<Shipment[]>([]);
  private _activeTab = signal<string>('all');
  public loading = signal<boolean>(false);
  public error = signal<string | null>(null);
  public updatingShipment = signal<string | null>(null);
  
  // Computed signals
  public shipments = computed(() => this._shipments());
  public activeTab = computed(() => this._activeTab());

  // Tab configuration
  tabs = [
    { id: 'all', label: 'All Shipments', icon: 'fa-list' },
    { id: 'pending_confirmation', label: 'Requests', icon: 'fa-clock' },
    { id: 'confirmed', label: 'Confirmed', icon: 'fa-check-circle' },
    { id: 'in_transit', label: 'In Transit', icon: 'fa-truck' },
    { id: 'delivered', label: 'Delivered', icon: 'fa-check-double' }
  ];

  constructor(
    private location: Location,
    private router: Router,
    private shipmentService: ShipmentService,
    private toastService: ToastService
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
    
    if (currentTab === 'all') {
      this.loadAllShipments();
    } else {
      this.loadShipmentsByStatus(currentTab);
    }
  }

  private loadAllShipments(): void {
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

  private loadShipmentsByStatus(status: string): void {
    this.shipmentService.getAgentShipmentsByStatus(status).subscribe({
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
}
