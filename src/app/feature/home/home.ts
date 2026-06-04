import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ShipmentService, Shipment } from '../../core/services/shipment.service';
import { QrCodeService } from '../../core/services/qr-code.service';
import { Agent, User } from '../../core/interfaces/auth.interface';
import { Footer } from '../../shared/footer/footer';
import { Header } from '../../shared/header/header';
import {
  getShipmentProgress,
  getShipmentProgressColor,
  getShipmentStageLabel,
  getProgressStages,
  formatShipmentStatus,
  getStatusBadgeClass,
  ProgressStage,
} from '../../core/helpers/shipment-progress.helper';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, Footer, Header],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  currentUser: User | null = null;
  isLoadingAgents = true;
  isLoadingShipments = true;
  isLoadingProducts = true;

  // Services exposed for template
  protected toastService: ToastService;

  // All agents from API
  allAgents: Agent[] = [];

  // Categorized agents
  nearbyAgents: Agent[] = [];
  topRatedAgents: Agent[] = [];
  expressAgents: Agent[] = [];
  bestValueAgents: Agent[] = [];
  newAgents: Agent[] = [];
  verifiedAgents: Agent[] = [];

  // Shipments and Products
  activeShipments: Shipment[] = [];
  recentProducts: any[] = [];

  // Agent shipments pagination
  agentShipmentsPage = 1;
  agentShipmentsPerPage = 10;
  agentShipmentsHasMore = false;
  isLoadingMoreShipments = false;

  // Agents pagination
  agentsPage = 1;
  agentsPerPage = 10;
  agentsHasMore = false;
  isLoadingMoreAgents = false;

  // Products pagination
  productsPage = 1;
  productsPerPage = 10;
  productsHasMore = false;
  isLoadingMoreProducts = false;

  // Track displayed agents to prevent repetition
  private displayedAgentIds: Set<number> = new Set();

  constructor(
    protected router: Router,
    private agentService: AgentService,
    private authService: AuthService,
    private shipmentService: ShipmentService,
    private qrCodeService: QrCodeService,
    toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    this.toastService = toastService;
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadAgents();
    this.loadShipments();
    this.loadProducts();
  }

  loadCurrentUser(): void {
    this.currentUser = this.authService.getUser();
  }

  loadAgents(): void {
    this.isLoadingAgents = true;
    this.agentService.getAvailableAgents(this.agentsPage, this.agentsPerPage).subscribe({
      next: (response) => {
        if (this.agentsPage === 1) {
          this.allAgents = response.agents;
        } else {
          this.allAgents = [...this.allAgents, ...response.agents];
        }
        this.agentsHasMore = response.pagination?.has_more ?? false;
        this.categorizeAgents();
        this.isLoadingAgents = false;
        this.isLoadingMoreAgents = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading agents:', err);
        this.toastService.error('Failed to load agents. Please try again.');
        this.isLoadingAgents = false;
        this.isLoadingMoreAgents = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadMoreAgents(): void {
    if (!this.agentsHasMore || this.isLoadingMoreAgents) return;
    this.isLoadingMoreAgents = true;
    this.agentsPage++;
    this.loadAgents();
  }

  categorizeAgents(): void {
    const userRegion = this.currentUser?.region;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Reset displayed agents tracking
    this.displayedAgentIds.clear();

    // Helper function to get agents not yet displayed
    const getUndisplayedAgents = (filterFn: (agent: Agent) => boolean, limit: number): Agent[] => {
      const filtered = this.allAgents
        .filter(agent => !this.displayedAgentIds.has(agent.id))
        .filter(filterFn)
        .slice(0, limit);
      
      // Mark these agents as displayed
      filtered.forEach(agent => this.displayedAgentIds.add(agent.id));
      return filtered;
    };

    // Priority 1: Nearby - Same region as user (highest priority)
    this.nearbyAgents = getUndisplayedAgents(
      agent => agent.region === userRegion,
      10
    );

    // Priority 2: Top Rated - Rating >= 4.5 with at least 5 reviews
    this.topRatedAgents = getUndisplayedAgents(
      agent => (agent.rating || 0) >= 4.5 && (agent.total_reviews || 0) >= 5,
      10
    ).sort((a, b) => (b.rating || 0) - (a.rating || 0));

    // Priority 3: Express - Specialization includes 'express'
    this.expressAgents = getUndisplayedAgents(
      agent => agent.specializations?.includes('express') || false,
      10
    ).sort((a, b) => (b.rating || 0) - (a.rating || 0));

    // Priority 4: Verified - is_verified = true
    this.verifiedAgents = getUndisplayedAgents(
      agent => agent.is_verified,
      10
    ).sort((a, b) => (b.rating || 0) - (a.rating || 0));

    // Priority 5: Best Value - Lowest base price (bottom 30%)
    const remainingForValue = this.allAgents.filter(agent => !this.displayedAgentIds.has(agent.id));
    const sortedByPrice = remainingForValue.sort((a, b) => (a.base_price || 999) - (b.base_price || 999));
    const thresholdIndex = Math.ceil(sortedByPrice.length * 0.3);
    this.bestValueAgents = sortedByPrice
      .slice(0, thresholdIndex > 0 ? thresholdIndex : 4)
      .slice(0, 10);
    this.bestValueAgents.forEach(agent => this.displayedAgentIds.add(agent.id));

    // Priority 6: New - Created within last 30 days (lowest priority)
    this.newAgents = getUndisplayedAgents(
      agent => {
        if (!agent.created_at) return false;
        const createdDate = new Date(agent.created_at);
        return createdDate > thirtyDaysAgo;
      },
      10
    ).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  goTo(route: string): void {
    this.router.navigate([route]);
  }

  getWelcomeMessage(): string {
    if (!this.currentUser) {
      return 'Welcome! Ready to ship with confidence?';
    }

    const role = this.currentUser.role;
    const name = this.currentUser.firstname;

    if (role === 'Seller' || role === 'seller' || role === 'agent') {
      return `Welcome back, ${name}! Ready to manage your deliveries and connect with customers?`;
    } else {
      return `Are you ready to ship today, ${name}? Find the best agents for your packages!`;
    }
  }

  viewAgentProfile(agentId: number): void {
    this.router.navigate(['/agent', agentId]);
  }

  viewShipmentDetails(shipmentId: string): void {
    this.router.navigate(['/account/shipping'], { queryParams: { highlight: shipmentId } });
  }

  viewProductDetails(productUuid: string): void {
    this.router.navigate(['/account/my-products'], { queryParams: { highlight: productUuid } });
  }

  getStatusClass(status: string): string {
    return getStatusBadgeClass(status);
  }

  getStatusLabel(status: string): string {
    return getShipmentStageLabel(status);
  }

  getProgressBarColor(status: string): string {
    return getShipmentProgressColor(status);
  }

  getProgressStagesForShipment(status: string): ProgressStage[] {
    return getProgressStages(status);
  }

  trackByAgentId(index: number, agent: Agent): number {
    return agent.id;
  }

  loadShipments(): void {
    this.isLoadingShipments = true;

    if (this.isAgent) {
      // Agents see their own active shipments (excluding delivered/cancelled), ordered by status priority
      this.shipmentService.getAgentShipments(this.agentShipmentsPage, this.agentShipmentsPerPage).subscribe({
        next: (response) => {
          if (response.success) {
            if (this.agentShipmentsPage === 1) {
              this.activeShipments = response.data.shipments;
            } else {
              this.activeShipments = [...this.activeShipments, ...response.data.shipments];
            }
            this.agentShipmentsHasMore = response.data.pagination?.has_more ?? false;
          }
          this.isLoadingShipments = false;
          this.isLoadingMoreShipments = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Error loading agent shipments:', err);
          this.isLoadingShipments = false;
          this.isLoadingMoreShipments = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      // Customers see their own active shipments
      this.shipmentService.getUserShipments(1, 10).subscribe({
        next: (response) => {
          if (response.success) {
            this.activeShipments = response.data.shipments
              .filter(shipment => !['cancelled', 'delivered'].includes(shipment.status))
              .slice(0, 5); // Show only 5 most recent
          }
          this.isLoadingShipments = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Error loading shipments:', err);
          this.isLoadingShipments = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  loadMoreAgentShipments(): void {
    if (!this.agentShipmentsHasMore || this.isLoadingMoreShipments) return;
    this.isLoadingMoreShipments = true;
    this.agentShipmentsPage++;
    this.loadShipments();
  }

  loadProducts(): void {
    this.isLoadingProducts = true;
    this.qrCodeService.getAll(this.productsPage, this.productsPerPage).subscribe({
      next: (res: any) => {
        console.log('[Home] Products response:', res);
        // Handle both old flat format and new paginated format
        const qrCodes = res?.data?.qr_codes ?? res?.data ?? [];
        const newProducts = Array.isArray(qrCodes) ? qrCodes : [];
        if (this.productsPage === 1) {
          this.recentProducts = newProducts;
        } else {
          this.recentProducts = [...this.recentProducts, ...newProducts];
        }
        this.productsHasMore = res?.data?.pagination?.has_more ?? false;
        this.isLoadingProducts = false;
        this.isLoadingMoreProducts = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('[Home] Error loading products:', err);
        this.isLoadingProducts = false;
        this.isLoadingMoreProducts = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadMoreProducts(): void {
    if (!this.productsHasMore || this.isLoadingMoreProducts) return;
    this.isLoadingMoreProducts = true;
    this.productsPage++;
    this.loadProducts();
  }

  get isAgent(): boolean {
    const role = this.currentUser?.role?.toLowerCase();
    return role === 'agent' || role === 'seller';
  }

  get activities(): { icon: string; label: string; route: string }[] {
    const base = [
      { icon: 'fa-solid fa-qrcode', label: 'Generate QRcode', route: '/qr-generator' },
      { icon: 'fa-solid fa-magnifying-glass', label: 'Search Agent', route: '/search' },
      { icon: 'fa-solid fa-location-crosshairs', label: 'Track Shipping', route: '/account/shipping' }
    ];
    if (this.isAgent) {
      base.push({ icon: 'fa-solid fa-camera', label: 'Scan QR', route: '/scan-qr' });
    }
    return base;
  }

  // Helper methods for template
  getShipmentProgress(shipment: Shipment): number {
    return getShipmentProgress(shipment.status);
  }

  getShipmentLocation(shipment: Shipment): { from: string; to: string } {
    return {
      from: shipment.pickup_address?.split(',')[0] || 'Unknown',
      to: shipment.destination_address?.split(',')[0] || 'Unknown'
    };
  }

  getAgentName(shipment: Shipment): string {
    if (shipment.agent) {
      return `${shipment.agent.firstname} ${shipment.agent.lastname}`;
    }
    return 'Unassigned';
  }

  getShipmentCustomerName(shipment: Shipment): string {
    if (shipment.user) {
      return `${shipment.user.firstname} ${shipment.user.lastname}`;
    }
    return 'Unknown';
  }

  getEstimatedDelivery(shipment: Shipment): string {
    return formatShipmentStatus(shipment.status);
  }

  /**
   * Capitalize each word in a string (e.g. 'hello world' → 'Hello World')
   */
  capitalize(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .toString()
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
