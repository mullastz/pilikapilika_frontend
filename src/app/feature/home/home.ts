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
    this.agentService.getAvailableAgents().subscribe({
      next: (agents: Agent[]) => {
        this.allAgents = agents;
        this.categorizeAgents();
        this.isLoadingAgents = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading agents:', err);
        this.toastService.error('Failed to load agents. Please try again.');
        this.isLoadingAgents = false;
        this.cdr.detectChanges();
      }
    });
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
    // Navigate to shipment details when backend is ready
    this.toastService.info('Shipment tracking coming soon');
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'in_transit':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'delivered':
        return 'Delivered';
      case 'in_transit':
        return 'In Transit';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  }

  getProgressBarColor(status: string): string {
    switch (status) {
      case 'delivered':
        return 'bg-green-500';
      case 'in_transit':
        return 'bg-blue-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  }

  trackByAgentId(index: number, agent: Agent): number {
    return agent.id;
  }

  loadShipments(): void {
    this.isLoadingShipments = true;
    this.shipmentService.getUserShipments().subscribe({
      next: (response) => {
        if (response.success) {
          // Get active shipments (not cancelled or delivered)
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

  loadProducts(): void {
    this.isLoadingProducts = true;
    this.qrCodeService.getAll().subscribe({
      next: (res: any) => {
        console.log('[Home] Products response:', res);
        this.recentProducts = res?.data ?? [];
        this.recentProducts = this.recentProducts.slice(0, 5); // Show only 5 most recent
        this.isLoadingProducts = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('[Home] Error loading products:', err);
        this.isLoadingProducts = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Activities for desktop
  activities = [
    { icon: 'fa-solid fa-user', label: 'Become Agent', route: '/sign-up' },
    { icon: 'fa-solid fa-qrcode', label: 'Generate QRcode', route: '/qr-generator' },
    { icon: 'fa-solid fa-magnifying-glass', label: 'Search Agent', route: '/search' },
    { icon: 'fa-solid fa-location-crosshairs', label: 'Track Shipping', route: '/account/shipping' },
    { icon: 'fa-solid fa-handshake', label: 'Negotiate', route: '/search' }
  ];

  // Helper methods for template
  getShipmentProgress(shipment: Shipment): number {
    switch (shipment.status) {
      case 'pending_confirmation':
        return 10;
      case 'confirmed':
        return 25;
      case 'in_transit':
        return 70;
      case 'delivered':
        return 100;
      default:
        return 0;
    }
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

  getEstimatedDelivery(shipment: Shipment): string {
    switch (shipment.status) {
      case 'pending_confirmation':
        return 'Pending confirmation';
      case 'confirmed':
        return 'Confirmed';
      case 'in_transit':
        return 'In transit';
      case 'delivered':
        return 'Delivered';
      default:
        return 'Unknown';
    }
  }
}
