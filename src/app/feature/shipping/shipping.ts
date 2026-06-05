import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';
import { ShipmentService, Shipment } from '../../core/services/shipment.service';
import {
  getShipmentProgress,
  getShipmentProgressColor,
  getShipmentStageLabel,
  isStageCompleted,
  isStageCurrent,
  getProgressStages,
  ProgressStage,
} from '../../core/helpers/shipment-progress.helper';
import { ContainerService, Container } from '../../core/services/container.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { QrCodeService } from '../../core/services/qr-code.service';
import { MenuBarService } from '../../core/services/menu-bar.service';
import { QRCodeComponent } from 'angularx-qrcode';

type QrScanPurpose = 'agent_load_container' | 'user_confirm_delivery';

@Component({
  selector: 'app-shipping',
  imports: [ CommonModule, FormsModule, QRCodeComponent ],
  templateUrl: './shipping.html',
  styleUrl: './shipping.css',
})
export class Shipping implements OnInit, OnDestroy {
  // Signals
  private _shipments = signal<Shipment[]>([]);
  private _activeTab = signal<string>('all');
  public loading = signal<boolean>(false);
  public error = signal<string | null>(null);
  public updatingShipment = signal<string | null>(null);

  // Pagination state
  public page = signal<number>(1);
  public perPage = signal<number>(10);
  public pagination = signal<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    has_more: boolean;
  } | null>(null);

  // Confirmation modal state
  public confirmModalOpen = signal(false);
  public confirmModalConfig = signal<{
    title: string;
    message: string;
    action: 'confirm' | 'reject' | 'cancel' | 'at_warehouse' | 'in_transit' | 'delivered' | 'user_delivered' | 'return_to_warehouse';
    shipment: Shipment | null;
  }>({ title: '', message: '', action: 'confirm', shipment: null });

  // View details modal state
  public viewModalOpen = signal(false);
  public viewModalClosing = signal(false);
  public viewModalLoading = signal(false);
  public viewModalError = signal<string | null>(null);
  public selectedShipmentDetail = signal<Shipment | null>(null);

  // QR view modal state
  public qrModalOpen = signal(false);
  public qrModalClosing = signal(false);
  public qrModalShipment = signal<Shipment | null>(null);

  // Tracking number modal state
  public trackingModalOpen = signal(false);
  public trackingModalShipment = signal<Shipment | null>(null);
  public trackingNumberInput = signal('');
  public trackingModalLoading = signal(false);

  // Product expand state for view modal
  public selectedProductUuid = signal<string | null>(null);
  public productDetailsMap = signal<Map<string, any>>(new Map());

  // Container management state
  public containers = signal<Container[]>([]);
  public containersLoading = signal(false);
  public containerModalOpen = signal(false);
  public containerModalClosing = signal(false);
  public selectedContainer = signal<Container | null>(null);
  public containerDetailOpen = signal(false);
  public containerDetailClosing = signal(false);
  public newContainerRef = signal('');
  public creatingContainer = signal(false);
  public scanningToContainer = signal(false);
  public updatingContainer = signal<string | null>(null);
  public selectedShipmentForContainer = signal<Shipment | null>(null);

  // Shipment container distribution data (for container detail view)
  public shipmentDistributions = signal<Record<string, {
    loading: boolean;
    error: string | null;
    data: {
      expected_quantity: number;
      loaded_quantity: number;
      remaining_quantity: number;
      is_fully_loaded: boolean;
      containers: { reference_number: string; quantity: number }[];
    } | null;
  }>>({});

  // Delivery readiness data per shipment
  public deliveryReadiness = signal<Record<string, {
    loading: boolean;
    error: string | null;
    data: {
      can_deliver: boolean;
      reason: string;
      pending_containers: { reference_number: string; status: string }[];
    } | null;
  }>>({});

  // Container quantity modal state
  public containerQuantityModalOpen = signal(false);
  public containerQuantityModalClosing = signal(false);
  public selectedContainerForQuantity = signal<Container | null>(null);
  public quantityToLoad = signal<number | null>(null);
  public quantityError = signal('');
  public containerStatusLoading = signal(false);
  public containerStatusError = signal<string | null>(null);
  public containerStatusData = signal<{
    expected_quantity: number;
    loaded_quantity: number;
    remaining_quantity: number;
    is_fully_loaded: boolean;
    containers: { reference_number: string; quantity: number }[];
  } | null>(null);

  // User delivery scan modal
  public deliveryScanModalOpen = signal(false);
  public deliveryScanShipment = signal<Shipment | null>(null);
  public deliveryScanLoading = signal(false);

  // QR Scanner modal state
  public qrScanModalOpen = signal(false);
  public qrScanPurpose = signal<QrScanPurpose>('agent_load_container');
  public qrScanContainerId = signal<string | null>(null);
  public qrScanShipmentId = signal<string | null>(null);
  public qrScanState = signal<'idle' | 'scanning' | 'processing' | 'success' | 'info' | 'error'>('idle');
  public qrScanMessage = signal<string>('');
  public qrScanCameraError = signal<string | null>(null);
  public qrScanInfoShipment = signal<any | null>(null);
  private html5QrCode: Html5Qrcode | null = null;
  private scanHandled = false;
  private lastScanTime = 0;

  // Pending QR scan for quantity modal
  private pendingQrScanContainerId = signal<string | null>(null);
  private pendingQrScanShipment = signal<Shipment | null>(null);

  // Partial receipt: client confirmation modal
  public partialConfirmModalOpen = signal(false);
  public partialConfirmModalClosing = signal(false);
  public partialConfirmShipment = signal<Shipment | null>(null);
  public partialConfirmLoading = signal(false);

  // Partial receipt: agent add remaining quantity modal
  public addRemainingModalOpen = signal(false);
  public addRemainingModalClosing = signal(false);
  public addRemainingShipment = signal<Shipment | null>(null);
  public addRemainingQuantityInput = signal<number | null>(null);
  public addRemainingError = signal<string>('');
  public addRemainingLoading = signal(false);

  // Action menu state (per shipment card)
  public openActionMenuId = signal<string | null>(null);

  // Additional info tooltip state (per shipment card)
  public expandedInfoId = signal<string | null>(null);

  // Computed signals
  public shipments = computed(() => this._shipments());
  public activeTab = computed(() => this._activeTab());
  public isAgent = computed(() => {
    const user = this.authService.getUser();
    const role = user?.role?.toLowerCase();
    return role === 'agent' || role === 'seller';
  });

  // Tab configuration for agents
  agentTabs = [
    { id: 'all', label: 'All Shipments', icon: 'fa-list' },
    { id: 'pending_confirmation', label: 'Requests', icon: 'fa-clock' },
    { id: 'confirmed', label: 'Confirmed', icon: 'fa-check-circle' },
    { id: 'partially_received', label: 'Partially Received', icon: 'fa-triangle-exclamation' },
    { id: 'at_warehouse', label: 'At Warehouse', icon: 'fa-warehouse' },
    { id: 'half_loaded', label: 'Half Loaded', icon: 'fa-box-open' },
    { id: 'loading_container', label: 'Loading', icon: 'fa-dolly' },
    { id: 'loaded_in_container', label: 'Loaded', icon: 'fa-box' },
    { id: 'at_port_abroad', label: 'At Port Abroad', icon: 'fa-anchor' },
    { id: 'in_transit', label: 'In Transit', icon: 'fa-truck' },
    { id: 'at_tanzania_port', label: 'At Port', icon: 'fa-ship' },
    { id: 'at_tanzania_warehouse', label: 'At TZ Warehouse', icon: 'fa-warehouse' },
    { id: 'delivered', label: 'Delivered', icon: 'fa-check-double' },
    { id: 'cancelled', label: 'Cancelled', icon: 'fa-times-circle' },
    { id: 'my_shippings', label: 'My Shippings', icon: 'fa-box' }
  ];

  // Tab configuration for normal users
  userTabs = [
    { id: 'all', label: 'All Shipments', icon: 'fa-list' },
    { id: 'pending_confirmation', label: 'Pending', icon: 'fa-clock' },
    { id: 'confirmed', label: 'Confirmed', icon: 'fa-check-circle' },
    { id: 'partially_received', label: 'Partially Received', icon: 'fa-triangle-exclamation' },
    { id: 'at_warehouse', label: 'At Warehouse', icon: 'fa-warehouse' },
    { id: 'half_loaded', label: 'Half Loaded', icon: 'fa-box-open' },
    { id: 'loading_container', label: 'Loading', icon: 'fa-dolly' },
    { id: 'loaded_in_container', label: 'Loaded', icon: 'fa-box' },
    { id: 'at_port_abroad', label: 'At Port Abroad', icon: 'fa-anchor' },
    { id: 'in_transit', label: 'In Transit', icon: 'fa-truck' },
    { id: 'at_tanzania_port', label: 'At Port', icon: 'fa-ship' },
    { id: 'at_tanzania_warehouse', label: 'At TZ Warehouse', icon: 'fa-warehouse' },
    { id: 'delivered', label: 'Delivered', icon: 'fa-check-double' },
    { id: 'cancelled', label: 'Cancelled', icon: 'fa-times-circle' }
  ];

  // Highlighted shipment ID from query params (when navigated from home)
  public highlightedShipmentId = signal<string | null>(null);

  constructor(
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
    private shipmentService: ShipmentService,
    private containerService: ContainerService,
    private toastService: ToastService,
    private authService: AuthService,
    private qrCodeService: QrCodeService,
    private menuBarService: MenuBarService
  ) {}

  ngOnInit(): void {
    // Check for highlight query param from home page navigation
    const highlightId = this.route.snapshot.queryParamMap.get('highlight');
    if (highlightId) {
      this.highlightedShipmentId.set(highlightId);
      // Clear the query param from URL without reloading
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { highlight: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    this.loadShipments();
  }

  ngOnDestroy(): void {
    this.stopQrScanner();
  }

  goBack(): void {
    this.location.back();
  }

  switchTab(tabId: string): void {
    this._activeTab.set(tabId);
    this.page.set(1);
    this.pagination.set(null);
    this.loadShipments();
  }

  goToPage(newPage: number): void {
    if (newPage < 1) return;
    const pag = this.pagination();
    if (pag && newPage > pag.last_page) return;
    this.page.set(newPage);
    this.loadShipments();
    // Scroll to top of shipment list
    const listEl = document.getElementById('shipments-list-top');
    if (listEl) {
      listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private loadShipments(): void {
    this.loading.set(true);
    this.error.set(null);

    const currentTab = this.activeTab();
    const isAgentUser = this.isAgent();
    const currentPage = this.page();
    const currentPerPage = this.perPage();
    
    if (isAgentUser) {
      if (currentTab === 'all') {
        this.loadAgentShipments(currentPage, currentPerPage);
      } else if (currentTab === 'my_shippings') {
        this.loadUserShipments(currentPage, currentPerPage);
      } else if (currentTab === 'cancelled') {
        this.loadAgentShipmentsByStatus('cancelled', currentPage, currentPerPage);
      } else {
        this.loadAgentShipmentsByStatus(currentTab, currentPage, currentPerPage);
      }
    } else {
      if (currentTab === 'all') {
        this.loadUserShipments(currentPage, currentPerPage);
      } else {
        this.loadUserShipmentsByStatus(currentTab, currentPage, currentPerPage);
      }
    }
  }

  private loadUserShipments(page: number = 1, perPage: number = 10): void {
    this.shipmentService.getUserShipments(page, perPage).subscribe({
      next: (response) => {
        if (response.success) {
          this._shipments.set(response.data.shipments);
          this.pagination.set(response.data.pagination ?? null);
          this.scrollToHighlightedShipment();
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

  private loadUserShipmentsByStatus(status: string, page: number = 1, perPage: number = 10): void {
    this.shipmentService.getUserShipmentsByStatus(status, page, perPage).subscribe({
      next: (response) => {
        if (response.success) {
          this._shipments.set(response.data.shipments);
          this.pagination.set(response.data.pagination ?? null);
          this.scrollToHighlightedShipment();
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

  private loadAgentShipments(page: number = 1, perPage: number = 10): void {
    this.shipmentService.getAgentShipments(page, perPage).subscribe({
      next: (response) => {
        if (response.success) {
          this._shipments.set(response.data.shipments);
          this.pagination.set(response.data.pagination ?? null);
          this.scrollToHighlightedShipment();
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

  private loadAgentShipmentsByStatus(status: string, page: number = 1, perPage: number = 10): void {
    this.loading.set(true);
    this.error.set(null);

    this.shipmentService.getAgentShipmentsByStatus(status, page, perPage).subscribe({
      next: (response) => {
        if (response.success) {
          this._shipments.set(response.data.shipments);
          this.pagination.set(response.data.pagination ?? null);
          this.scrollToHighlightedShipment();
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

  private loadCancelledShipments(page: number = 1, perPage: number = 10): void {
    this.loading.set(true);
    this.error.set(null);

    this.shipmentService.getAgentShipmentsByStatus('cancelled', page, perPage).subscribe({
      next: (response) => {
        if (response.success) {
          this._shipments.set(response.data.shipments);
          this.pagination.set(response.data.pagination ?? null);
          this.scrollToHighlightedShipment();
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
      case 'delivered':        return 'bg-green-100 text-green-600';
      case 'in_transit':       return 'bg-blue-100 text-blue-600';
      case 'at_warehouse':     return 'bg-indigo-100 text-indigo-600';
      case 'partially_received': return 'bg-yellow-100 text-yellow-600';
      case 'half_loaded':      return 'bg-amber-100 text-amber-600';
      case 'loading_container': return 'bg-orange-100 text-orange-600';
      case 'loaded_in_container': return 'bg-teal-100 text-teal-600';
      case 'at_tanzania_port': return 'bg-cyan-100 text-cyan-600';
      case 'at_tanzania_warehouse': return 'bg-sky-100 text-sky-600';
      case 'confirmed':        return 'bg-purple-100 text-purple-600';
      case 'pending_confirmation': return 'bg-yellow-100 text-yellow-600';
      case 'cancelled':        return 'bg-red-100 text-red-600';
      case 'draft':            return 'bg-gray-100 text-gray-600';
      case 'closed':           return 'bg-teal-100 text-teal-600';
      default:                 return 'bg-gray-200 text-gray-600';
    }
  }

  getStatusAccentClass(status: string): string {
    switch (status) {
      case 'delivered':        return 'bg-green-400';
      case 'in_transit':       return 'bg-blue-400';
      case 'at_warehouse':     return 'bg-indigo-400';
      case 'half_loaded':      return 'bg-amber-400';
      case 'loading_container': return 'bg-orange-400';
      case 'loaded_in_container': return 'bg-teal-400';
      case 'at_tanzania_port': return 'bg-cyan-400';
      case 'at_tanzania_warehouse': return 'bg-sky-400';
      case 'confirmed':        return 'bg-purple-400';
      case 'pending_confirmation': return 'bg-yellow-400';
      case 'cancelled':        return 'bg-red-400';
      case 'draft':            return 'bg-gray-400';
      case 'closed':           return 'bg-teal-400';
      default:                 return 'bg-gray-400';
    }
  }

  formatStatus(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Capitalize helper for names, regions, etc.
  capitalize(value: string | null | undefined): string {
    if (!value) return '';
    return value.toString().toLowerCase().split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Pagination pages array with smart ellipsis
  get pages(): (number | string)[] {
    const pag = this.pagination();
    if (!pag) return [];
    const total = pag.last_page;
    const current = pag.current_page;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  // Progress bar helpers
  getShipmentProgress(status: string): number {
    return getShipmentProgress(status);
  }

  getShipmentProgressColor(status: string): string {
    return getShipmentProgressColor(status);
  }

  getShipmentStageLabel(status: string): string {
    return getShipmentStageLabel(status);
  }

  isStageCompleted(shipmentStatus: string, stageStatus: string): boolean {
    return isStageCompleted(shipmentStatus, stageStatus);
  }

  isStageCurrent(shipmentStatus: string, stageStatus: string): boolean {
    return isStageCurrent(shipmentStatus, stageStatus);
  }

  getProgressStages(status: string): ProgressStage[] {
    return getProgressStages(status);
  }

  trackShipment(shipment: Shipment): void {
    this.router.navigate(['/track-shipping', shipment.id]);
  }

  refreshShipments(): void {
    this.loadShipments();
  }

  isHighlighted(shipmentId: string): boolean {
    return this.highlightedShipmentId() === shipmentId;
  }

  private scrollToHighlightedShipment(): void {
    const highlightId = this.highlightedShipmentId();
    if (!highlightId) return;

    // Check if the highlighted shipment is in the current list
    const found = this.shipments().some(s => s.id === highlightId);
    if (!found) return;

    // Scroll to the element after the DOM updates
    setTimeout(() => {
      const element = document.getElementById(`shipment-card-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Clear highlight after 3 seconds
        setTimeout(() => this.highlightedShipmentId.set(null), 3000);
      }
    }, 300);
  }

  // View details modal methods
  openViewModal(shipment: Shipment): void {
    this.menuBarService.hide();
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
          // Fetch container distribution data (will show if shipment was ever loaded into containers)
          this.loadShipmentDistribution(response.data.shipment.id);
          // Fetch delivery readiness for containerized shipments
          if (response.data.shipment.container_id) {
            this.loadDeliveryReadiness(response.data.shipment.id);
          }
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
    this.viewModalClosing.set(true);
    setTimeout(() => {
      this.viewModalOpen.set(false);
      this.viewModalClosing.set(false);
      this.viewModalLoading.set(false);
      this.viewModalError.set(null);
      this.selectedShipmentDetail.set(null);
      this.selectedProductUuid.set(null);
      this.productDetailsMap.set(new Map());
      this.shipmentDistributions.set({});
      this.deliveryReadiness.set({});
      this.menuBarService.show();
    }, 280);
  }

  // QR modal methods
  openQrModal(shipment: Shipment): void {
    this.menuBarService.hide();
    this.qrModalOpen.set(true);
    this.qrModalShipment.set(shipment);
  }

  closeQrModal(): void {
    this.qrModalClosing.set(true);
    setTimeout(() => {
      this.qrModalOpen.set(false);
      this.qrModalClosing.set(false);
      this.qrModalShipment.set(null);
      this.menuBarService.show();
    }, 280);
  }

  getQrData(product: any): string {
    if (product.qr_data) {
      return product.qr_data;
    }
    if (product.qr_code_uuid) {
      return `${window.location.origin}/qr/${product.qr_code_uuid}`;
    }
    return '';
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
          this.loadShipments();
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

  markAsAtWarehouse(shipment: Shipment): void {
    this.updatingShipment.set(shipment.id);
    this.shipmentService.markAsAtWarehouse(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Shipment marked as at warehouse');
          this.loadShipments();
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

  markAsAtPortAbroad(shipment: Shipment): void {
    this.updatingShipment.set(shipment.id);
    this.shipmentService.markAsAtPortAbroad(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Shipment marked as at port abroad');
          this.loadShipments();
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

  markAsInTransit(shipment: Shipment): void {
    this.updatingShipment.set(shipment.id);
    this.shipmentService.markAsInTransit(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Shipment marked as in transit');
          this.loadShipments();
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
          this.loadShipments();
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

  canMarkAtWarehouse(shipment: Shipment): boolean {
    return shipment.status === 'confirmed';
  }

  canMarkInTransit(shipment: Shipment): boolean {
    // Only non-containerized shipments that are at_port_abroad can be marked in transit individually
    // Containerized shipments get in_transit via container status cascade
    return shipment.status === 'at_port_abroad' && !shipment.container_id;
  }

  canMarkDelivered(shipment: Shipment): boolean {
    // Containerized shipments: only from at_tanzania_warehouse
    // Non-containerized shipments: from in_transit or at_tanzania_warehouse
    if (shipment.container_id) {
      return shipment.status === 'at_tanzania_warehouse';
    }
    return shipment.status === 'at_tanzania_warehouse' || shipment.status === 'in_transit';
  }

  /**
   * Check if a partially received shipment has been unblocked
   * (either client confirmed or quantity was adjusted)
   */
  isPartiallyReceivedUnblocked(shipment: Shipment): boolean {
    return shipment.status === 'partially_received' &&
      (!!shipment.quantity_adjusted || !!shipment.client_confirmed_at);
  }

  canLoadToContainer(shipment: Shipment): boolean {
    // Allow loading if at warehouse, half loaded, or partially received but unblocked
    if (shipment.status === 'at_warehouse' || shipment.status === 'half_loaded') {
      return true;
    }
    return this.isPartiallyReceivedUnblocked(shipment);
  }

  getMaxLoadQuantity(): number {
    const shipment = this.selectedShipmentForContainer();
    if (!shipment) return 1;

    const expected = this.getExpectedQuantity(shipment);

    // For at_warehouse, max is the total
    if (shipment.status === 'at_warehouse') {
      return expected;
    }

    // For half_loaded, max is the remaining
    const statusData = this.containerStatusData();
    return statusData?.remaining_quantity ?? expected;
  }

  getExpectedQuantity(shipment: Shipment): number {
    const products = shipment.products ?? [];
    if (!Array.isArray(products) || products.length === 0) {
      return 1;
    }

    // Handle nested array: [[{quantity: 12}]]
    let firstProduct = products[0];
    if (Array.isArray(firstProduct) && firstProduct.length > 0) {
      firstProduct = firstProduct[0];
    }

    if (firstProduct && (typeof firstProduct.quantity === 'number' || typeof firstProduct.quantity === 'string')) {
      const qty = parseInt(String(firstProduct.quantity), 10);
      return isNaN(qty) || qty < 1 ? 1 : qty;
    }

    return 1;
  }

  getRemainingQuantity(shipment: Shipment): number {
    // For now, we can't know remaining from frontend alone without API call
    // So we use expected quantity as a proxy; the backend will validate
    return this.getExpectedQuantity(shipment);
  }

  getLoadedQuantityDisplay(shipment: Shipment): string {
    const expected = this.getExpectedQuantity(shipment);
    if (expected <= 1) return '';
    if (shipment.container_id) {
      return `Loaded in container`;
    }
    return `${expected} units`;
  }

  canRemoveFromContainer(shipment: Shipment): boolean {
    return shipment.status === 'loading_container' && !!shipment.container_id;
  }

  canUserConfirmDelivery(shipment: Shipment): boolean {
    return shipment.status === 'at_tanzania_warehouse';
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
          this.loadShipments();
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
          this.loadShipments();
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

  // Return shipment to warehouse (for loaded_in_container shipments)
  returnToWarehouse(shipment: Shipment): void {
    if (!shipment.container_id) return;
    this.updatingShipment.set(shipment.id);
    this.containerService.returnShipmentToWarehouse(shipment.container_id, shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Shipment returned to warehouse successfully');
          this.loadShipments();
        } else {
          this.toastService.error(response.message || 'Failed to return shipment to warehouse');
        }
        this.updatingShipment.set(null);
      },
      error: (error: any) => {
        console.error('Failed to return shipment to warehouse:', error);
        this.toastService.error('Failed to return shipment to warehouse');
        this.updatingShipment.set(null);
      }
    });
  }

  canCancel(shipment: Shipment): boolean {
    return shipment.status !== 'delivered' && shipment.status !== 'cancelled' && shipment.status !== 'loaded_in_container' && shipment.status !== 'at_port_abroad' && shipment.status !== 'in_transit' && shipment.status !== 'at_tanzania_port' && shipment.status !== 'at_tanzania_warehouse';
  }

  canReturnToWarehouse(shipment: Shipment): boolean {
    return shipment.status === 'loaded_in_container' && !!shipment.container_id;
  }

  // Confirmation modal methods
  openConfirmModal(
    shipment: Shipment,
    action: 'confirm' | 'reject' | 'cancel' | 'at_warehouse' | 'in_transit' | 'delivered' | 'user_delivered' | 'return_to_warehouse'
  ): void {
    const configMap: Record<typeof action, { title: string; message: string }> = {
      confirm: { title: 'Confirm Shipment', message: 'Are you sure you want to confirm this shipment request?' },
      reject: { title: 'Reject Shipment', message: 'Are you sure you want to reject this shipment request?' },
      cancel: { title: 'Cancel Shipment', message: 'Are you sure you want to cancel this shipment?' },
      at_warehouse: { title: 'Mark as At Warehouse', message: 'Are you sure you want to mark this shipment as at warehouse?' },
      in_transit: { title: 'Mark as In Transit', message: 'Are you sure you want to mark this shipment as in transit?' },
      delivered: { title: 'Mark as Delivered', message: 'Are you sure you want to mark this shipment as delivered?' },
      user_delivered: { title: 'Confirm Delivery', message: 'Are you sure you want to confirm delivery of this shipment?' },
      return_to_warehouse: { title: 'Return to Warehouse', message: 'This will remove the shipment from the container and return it to warehouse status. Are you sure?' },
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
      case 'at_warehouse':
        this.markAsAtWarehouse(cfg.shipment);
        break;
      case 'in_transit':
        this.markAsInTransit(cfg.shipment);
        break;
      case 'delivered':
        this.markAsDelivered(cfg.shipment);
        break;
      case 'user_delivered':
        this.confirmUserDelivery(cfg.shipment);
        break;
      case 'return_to_warehouse':
        this.returnToWarehouse(cfg.shipment);
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

  markAsAtWarehouseAction(shipment: Shipment): void {
    this.openConfirmModal(shipment, 'at_warehouse');
  }

  markAsInTransitAction(shipment: Shipment): void {
    this.openConfirmModal(shipment, 'in_transit');
  }

  markAsDeliveredAction(shipment: Shipment): void {
    this.openConfirmModal(shipment, 'delivered');
  }

  confirmUserDeliveryAction(shipment: Shipment): void {
    this.openConfirmModal(shipment, 'user_delivered');
  }

  returnToWarehouseAction(shipment: Shipment): void {
    this.openConfirmModal(shipment, 'return_to_warehouse');
  }

  // User delivery confirmation
  confirmUserDelivery(shipment: Shipment): void {
    this.updatingShipment.set(shipment.id);
    this.shipmentService.markAsUserDelivered(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success(response.message || 'Delivery confirmed successfully');
          this.loadShipments();
        } else {
          this.toastService.error(response.message || 'Failed to confirm delivery');
        }
        this.updatingShipment.set(null);
      },
      error: (error: any) => {
        console.error('Failed to confirm delivery:', error);
        this.toastService.error('Failed to confirm delivery');
        this.updatingShipment.set(null);
      }
    });
  }

  // Container management methods
  loadContainers(): void {
    this.containersLoading.set(true);
    this.containerService.getContainers().subscribe({
      next: (response) => {
        if (response.success) {
          this.containers.set(response.data.containers);
        }
        this.containersLoading.set(false);
      },
      error: (error: any) => {
        console.error('Failed to load containers:', error);
        this.containersLoading.set(false);
      }
    });
  }

  openContainerModal(shipment?: Shipment): void {
    this.menuBarService.hide();
    this.containerModalOpen.set(true);
    this.selectedShipmentForContainer.set(shipment || null);
    this.loadContainers();
  }

  closeContainerModal(): void {
    this.containerModalClosing.set(true);
    setTimeout(() => {
      this.containerModalOpen.set(false);
      this.containerModalClosing.set(false);
      this.selectedContainer.set(null);
      this.containerDetailOpen.set(false);
      this.containerDetailClosing.set(false);
      this.menuBarService.show();
    }, 280);
  }

  openContainerDetail(container: Container): void {
    this.menuBarService.hide();
    this.containerDetailOpen.set(true);
    this.selectedContainer.set(container);
    this.shipmentDistributions.set({});
    this.containerService.getContainer(container.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.selectedContainer.set(response.data.container);
          // Fetch distribution data for each shipment that is half_loaded
          const shipments = response.data.container?.shipments || [];
          shipments.forEach((shipment: Shipment) => {
            if (shipment.status === 'half_loaded' || shipment.status === 'loading_container') {
              this.loadShipmentDistribution(shipment.id);
            }
          });
        }
      },
      error: (error: any) => {
        console.error('Failed to load container details:', error);
      }
    });
  }

  loadDeliveryReadiness(shipmentId: string): void {
    this.deliveryReadiness.update(readiness => ({
      ...readiness,
      [shipmentId]: { loading: true, error: null, data: null }
    }));
    this.shipmentService.getDeliveryReadiness(shipmentId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.deliveryReadiness.update(readiness => ({
            ...readiness,
            [shipmentId]: { loading: false, error: null, data: response.data }
          }));
        } else {
          this.deliveryReadiness.update(readiness => ({
            ...readiness,
            [shipmentId]: { loading: false, error: 'Failed to load', data: null }
          }));
        }
      },
      error: () => {
        this.deliveryReadiness.update(readiness => ({
          ...readiness,
          [shipmentId]: { loading: false, error: 'Failed to load', data: null }
        }));
      }
    });
  }

  getDeliveryReadiness(shipmentId: string) {
    return this.deliveryReadiness()[shipmentId] || null;
  }

  loadShipmentDistribution(shipmentId: string): void {
    this.shipmentDistributions.update(dists => ({
      ...dists,
      [shipmentId]: { loading: true, error: null, data: null }
    }));
    this.shipmentService.getContainerStatus(shipmentId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.shipmentDistributions.update(dists => ({
            ...dists,
            [shipmentId]: { loading: false, error: null, data: response.data }
          }));
        } else {
          this.shipmentDistributions.update(dists => ({
            ...dists,
            [shipmentId]: { loading: false, error: 'Failed to load', data: null }
          }));
        }
      },
      error: () => {
        this.shipmentDistributions.update(dists => ({
          ...dists,
          [shipmentId]: { loading: false, error: 'Failed to load', data: null }
        }));
      }
    });
  }

  getShipmentDistribution(shipmentId: string) {
    return this.shipmentDistributions()[shipmentId] || null;
  }

  closeContainerDetail(): void {
    this.containerDetailClosing.set(true);
    setTimeout(() => {
      this.containerDetailOpen.set(false);
      this.containerDetailClosing.set(false);
      this.selectedContainer.set(null);
      this.shipmentDistributions.set({});
      this.menuBarService.show();
    }, 280);
  }

  createContainer(): void {
    const ref = this.newContainerRef().trim();
    if (!ref) {
      this.toastService.error('Please enter a reference number');
      return;
    }
    this.creatingContainer.set(true);
    this.containerService.createContainer(ref).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Container created successfully');
          this.newContainerRef.set('');
          this.loadContainers();
        } else {
          this.toastService.error(response.message || 'Failed to create container');
        }
        this.creatingContainer.set(false);
      },
      error: (error: any) => {
        console.error('Failed to create container:', error);
        this.toastService.error('Failed to create container');
        this.creatingContainer.set(false);
      }
    });
  }

  // Quantity modal methods
  openQuantityModal(container: Container, shipment: Shipment): void {
    this.selectedContainerForQuantity.set(container);
    this.selectedShipmentForContainer.set(shipment);
    this.quantityToLoad.set(null);
    this.quantityError.set('');
    this.containerStatusData.set(null);
    this.containerStatusError.set(null);
    this.containerQuantityModalOpen.set(true);

    // Only fetch container status for half_loaded shipments
    // For at_warehouse, we just show Total Quantity (simple view)
    if (shipment.status === 'half_loaded') {
      this.containerStatusLoading.set(true);
      this.shipmentService.getContainerStatus(shipment.id).subscribe({
        next: (response) => {
          console.log('Container status API response:', response);
          if (response.success && response.data) {
            this.containerStatusData.set(response.data);
            this.containerStatusError.set(null);
          } else {
            console.warn('Container status API returned success=false or no data:', response);
            this.containerStatusError.set('Failed to load container status');
          }
          this.containerStatusLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to fetch container status:', error);
          this.containerStatusError.set('Failed to load container status. Please try again.');
          this.containerStatusLoading.set(false);
        }
      });
    }
  }

  closeQuantityModal(): void {
    this.containerQuantityModalClosing.set(true);
    setTimeout(() => {
      this.containerQuantityModalOpen.set(false);
      this.containerQuantityModalClosing.set(false);
      this.selectedContainerForQuantity.set(null);
      this.quantityToLoad.set(null);
      this.quantityError.set('');
      this.containerStatusData.set(null);
      this.containerStatusLoading.set(false);
      this.containerStatusError.set(null);
    }, 280);
  }

  onQuantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    this.quantityToLoad.set(isNaN(val) ? null : val);
    this.quantityError.set('');
  }

  submitLoadWithQuantity(): void {
    const container = this.selectedContainerForQuantity();
    const shipment = this.selectedShipmentForContainer();
    if (!container || !shipment) return;

    const qty = this.quantityToLoad();
    if (qty === null || qty === undefined || qty < 1 || isNaN(qty)) {
      this.quantityError.set('Please enter a valid quantity (1 or more)');
      return;
    }

    const maxQty = this.getMaxLoadQuantity();

    if (qty > maxQty) {
      this.quantityError.set(`Cannot load more than ${maxQty} unit(s)`);
      return;
    }

    this.doLoadShipment(container.id, shipment.id, qty);
  }

  loadAllQuantity(): void {
    const container = this.selectedContainerForQuantity();
    const shipment = this.selectedShipmentForContainer();
    if (!container || !shipment) return;

    const expected = this.getExpectedQuantity(shipment);
    this.doLoadShipment(container.id, shipment.id, expected);
  }

  loadAllRemainingQuantity(): void {
    const container = this.selectedContainerForQuantity();
    const shipment = this.selectedShipmentForContainer();
    if (!container || !shipment) return;

    const statusData = this.containerStatusData();
    const remaining = statusData?.remaining_quantity ?? this.getExpectedQuantity(shipment);
    this.doLoadShipment(container.id, shipment.id, remaining);
  }

  private doLoadShipment(containerId: string, shipmentId: string, qty: number): void {
    this.quantityError.set('');
    this.updatingShipment.set(shipmentId);
    this.containerService.addShipment(containerId, shipmentId, qty).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success(response.message || 'Shipment added to container');
          this.loadShipments();
          this.closeQuantityModal();
        } else {
          this.toastService.error(response.message || 'Failed to add shipment');
        }
        this.updatingShipment.set(null);
      },
      error: (error: any) => {
        console.error('Failed to add shipment to container:', error);
        this.toastService.error('Failed to add shipment to container');
        this.updatingShipment.set(null);
      }
    });
  }

  loadShipmentToContainer(containerId: string): void {
    const shipment = this.selectedShipmentForContainer();
    if (!shipment) return;

    const expected = this.getExpectedQuantity(shipment);
    const container = this.containers().find(c => c.id === containerId);
    if (!container) return;

    // If quantity is 1 or shipment has no explicit quantity, load directly
    // Otherwise show quantity modal
    if (expected <= 1) {
      this.updatingShipment.set(shipment.id);
      this.containerService.addShipment(containerId, shipment.id, 1).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Shipment added to container');
            this.loadShipments();
            this.selectedShipmentForContainer.set(null);
          } else {
            this.toastService.error(response.message || 'Failed to add shipment');
          }
          this.updatingShipment.set(null);
        },
        error: (error: any) => {
          console.error('Failed to add shipment to container:', error);
          this.toastService.error('Failed to add shipment to container');
          this.updatingShipment.set(null);
        }
      });
    } else {
      // Show quantity modal
      this.openQuantityModal(container, shipment);
    }
  }

  removeShipmentFromContainer(shipment: Shipment): void {
    if (!shipment.container_id) return;
    this.updatingShipment.set(shipment.id);
    this.containerService.removeShipment(shipment.container_id, shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Shipment removed from container');
          this.loadShipments();
        } else {
          this.toastService.error(response.message || 'Failed to remove shipment');
        }
        this.updatingShipment.set(null);
      },
      error: (error: any) => {
        console.error('Failed to remove shipment from container:', error);
        this.toastService.error('Failed to remove shipment from container');
        this.updatingShipment.set(null);
      }
    });
  }

  closeContainer(containerId: string): void {
    this.updatingContainer.set(containerId);
    this.containerService.closeContainer(containerId).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Container closed successfully');
          this.loadContainers();
          this.loadShipments();
        } else {
          this.toastService.error(response.message || 'Failed to close container');
        }
        this.updatingContainer.set(null);
      },
      error: (error: any) => {
        console.error('Failed to close container:', error);
        this.toastService.error('Failed to close container');
        this.updatingContainer.set(null);
      }
    });
  }

  updateContainerStatus(containerId: string, status: string): void {
    this.updatingContainer.set(containerId);
    this.containerService.updateContainerStatus(containerId, status).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success(`Container updated to ${status.replace(/_/g, ' ')}`);
          this.loadContainers();
          this.loadShipments();
        } else {
          this.toastService.error(response.message || 'Failed to update container');
        }
        this.updatingContainer.set(null);
      },
      error: (error: any) => {
        console.error('Failed to update container status:', error);
        this.toastService.error('Failed to update container status');
        this.updatingContainer.set(null);
      }
    });
  }

  getNextContainerStatus(status: string): string | null {
    const flow: Record<string, string> = {
      'closed': 'at_port_abroad',
      'at_port_abroad': 'in_transit',
      'in_transit': 'at_tanzania_port',
      'at_tanzania_port': 'at_tanzania_warehouse',
    };
    return flow[status] || null;
  }

  getNextContainerStatusLabel(status: string): string {
    const next = this.getNextContainerStatus(status);
    return next ? next.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
  }

  // Tracking number methods
  openTrackingModal(shipment: Shipment): void {
    this.trackingModalShipment.set(shipment);
    this.trackingNumberInput.set(shipment.external_tracking_number || '');
    this.trackingModalOpen.set(true);
  }

  closeTrackingModal(): void {
    this.trackingModalOpen.set(false);
    this.trackingModalShipment.set(null);
    this.trackingNumberInput.set('');
  }

  submitTrackingNumber(): void {
    const shipment = this.trackingModalShipment();
    const trackingNumber = this.trackingNumberInput().trim();

    if (!shipment || !trackingNumber) {
      this.toastService.error('Please enter a tracking number');
      return;
    }

    this.trackingModalLoading.set(true);

    this.shipmentService.updateTrackingNumber(shipment.id, trackingNumber).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Tracking number added successfully');
          this.closeTrackingModal();
          this.loadShipments();
        } else {
          this.toastService.error(response.message || 'Failed to add tracking number');
        }
        this.trackingModalLoading.set(false);
      },
      error: (error: any) => {
        console.error('Failed to add tracking number:', error);
        this.toastService.error('Failed to add tracking number');
        this.trackingModalLoading.set(false);
      }
    });
  }

  canAddTrackingNumber(shipment: Shipment): boolean {
    return !shipment.external_tracking_number;
  }

  canEditTrackingNumber(shipment: Shipment): boolean {
    const user = this.authService.getUser();
    return !!shipment.external_tracking_number && shipment.external_tracking_added_by === user?.uuid;
  }

  isEditingTrackingNumber(): boolean {
    const shipment = this.trackingModalShipment();
    return !!shipment?.external_tracking_number;
  }

  hasTrackingNumber(shipment: Shipment): boolean {
    return !!shipment.external_tracking_number;
  }

  // QR Scanner Modal methods
  openQrScanner(purpose: QrScanPurpose, options?: { containerId?: string; shipmentId?: string }): void {
    this.qrScanPurpose.set(purpose);
    this.qrScanContainerId.set(options?.containerId ?? null);
    this.qrScanShipmentId.set(options?.shipmentId ?? null);
    this.qrScanModalOpen.set(true);
    this.qrScanState.set('idle');
    this.qrScanMessage.set('');
    this.qrScanCameraError.set(null);
    this.qrScanInfoShipment.set(null);
  }

  closeQrScannerModal(): void {
    this.stopQrScanner();
    this.qrScanModalOpen.set(false);
    this.qrScanState.set('idle');
    this.qrScanMessage.set('');
    this.qrScanCameraError.set(null);
    this.qrScanInfoShipment.set(null);
    this.scanHandled = false;
  }

  async beginQrScanning(): Promise<void> {
    await this.stopQrScanner();
    this.scanHandled = false;
    this.lastScanTime = 0;
    this.qrScanState.set('scanning');
    this.qrScanCameraError.set(null);
    setTimeout(() => this.startQrScanner(), 100);
  }

  async startQrScanner(): Promise<void> {
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure) {
      this.qrScanState.set('error');
      this.qrScanMessage.set('Camera access requires a secure connection (HTTPS).');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.qrScanState.set('error');
      this.qrScanMessage.set('Your browser does not support camera access.');
      return;
    }
    const readerEl = document.getElementById('shipping-qr-reader');
    if (!readerEl) {
      this.qrScanState.set('error');
      this.qrScanMessage.set('Scanner element not found.');
      return;
    }

    // Explicitly request camera permission first — this triggers the browser
    // permission prompt on devices where html5-qrcode.start() fails to do so.
    try {
      const fallbackConstraints = { video: true };
      const preferredConstraints = { video: { facingMode: 'environment' } };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }
      // Stop all tracks so html5-qrcode can take over the camera cleanly
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      console.error('Camera permission error:', err);
      const name = err?.name || '';
      const msg = err?.message || '';
      if (name === 'NotAllowedError' || msg.includes('Permission denied') || msg.includes('permission')) {
        this.qrScanCameraError.set('Camera access denied. Please allow camera permission.');
      } else if (name === 'NotFoundError' || msg.includes('device not found') || msg.includes('no camera')) {
        this.qrScanCameraError.set('No camera found on this device.');
      } else if (name === 'NotReadableError' || msg.includes('in use') || msg.includes('busy')) {
        this.qrScanCameraError.set('Camera is already in use.');
      } else {
        this.qrScanCameraError.set(msg || 'Unable to start camera.');
      }
      this.qrScanState.set('error');
      return;
    }

    this.html5QrCode = new Html5Qrcode('shipping-qr-reader');
    try {
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10 },
        (decodedText: string) => {
          if (this.scanHandled || this.qrScanState() !== 'scanning') return;
          const now = Date.now();
          if (now - this.lastScanTime < 3000) return;
          this.lastScanTime = now;
          this.scanHandled = true;
          this.handleQrScan(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      console.error('Camera error:', err);
      const name = err?.name || '';
      const msg = err?.message || '';
      if (name === 'NotAllowedError' || msg.includes('Permission denied') || msg.includes('permission')) {
        this.qrScanCameraError.set('Camera access denied. Please allow camera permission.');
      } else if (name === 'NotFoundError' || msg.includes('device not found') || msg.includes('no camera')) {
        this.qrScanCameraError.set('No camera found on this device.');
      } else if (name === 'NotReadableError' || msg.includes('in use') || msg.includes('busy')) {
        this.qrScanCameraError.set('Camera is already in use.');
      } else {
        this.qrScanCameraError.set(msg || 'Unable to start camera.');
      }
      this.qrScanState.set('error');
    }
  }

  async stopQrScanner(): Promise<void> {
    if (this.html5QrCode) {
      try {
        await this.html5QrCode.stop();
        await this.html5QrCode.clear();
      } catch {}
      this.html5QrCode = null;
    }
  }

  extractUuid(text: string): string | null {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = text.match(uuidRegex);
    return match ? match[0] : null;
  }

  async handleQrScan(decodedText: string): Promise<void> {
    await this.stopQrScanner();
    const uuid = this.extractUuid(decodedText);
    if (!uuid) {
      this.qrScanState.set('error');
      this.qrScanMessage.set('Invalid QR code. No valid UUID found.');
      return;
    }
    this.qrScanState.set('processing');

    if (this.qrScanPurpose() === 'agent_load_container' && this.qrScanContainerId()) {
      // First, get shipment info without loading (preview)
      this.shipmentService.approveByQrCode(uuid, undefined, true).subscribe({
        next: (response) => {
          if (response.success && response.preview && response.data?.shipment) {
            const shipment = response.data.shipment;
            const containerId = this.qrScanContainerId()!;
            const container = this.containers().find(c => c.id === containerId);

            if (!container) {
              this.qrScanState.set('error');
              this.qrScanMessage.set('Container not found');
              return;
            }

            // Check if shipment is valid for loading (at_warehouse or half_loaded status)
            if (shipment.status !== 'at_warehouse' && shipment.status !== 'half_loaded') {
              this.qrScanState.set('info');
              this.qrScanMessage.set('Shipment must be at warehouse or half loaded before adding to container. Current status: ' + shipment.status);
              this.qrScanInfoShipment.set(shipment);
              return;
            }

            // Check if already fully loaded by fetching container status
            this.shipmentService.getContainerStatus(shipment.id).subscribe({
              next: (statusResponse) => {
                console.log('QR scan - container status:', statusResponse);
                if (statusResponse.success && statusResponse.data.is_fully_loaded) {
                  this.qrScanState.set('info');
                  this.qrScanMessage.set('All quantity for this shipment is already loaded in containers');
                  this.qrScanInfoShipment.set(shipment);
                  return;
                }

                // Close QR scanner and show quantity modal
                this.closeQrScannerModal();
                this.openQuantityModal(container, shipment);
              },
              error: () => {
                // If status fetch fails, still try to show modal
                this.closeQrScannerModal();
                this.openQuantityModal(container, shipment);
              }
            });
          } else if (response.success && response.info) {
            this.qrScanState.set('info');
            this.qrScanMessage.set(response.message || 'No update performed');
            this.qrScanInfoShipment.set(response.data?.shipment ?? null);
          } else {
            this.qrScanState.set('error');
            this.qrScanMessage.set(response.message || 'Failed to find shipment');
          }
        },
        error: (err: any) => {
          this.qrScanState.set('error');
          this.qrScanMessage.set(err?.error?.message || 'Something went wrong. Please try again.');
        }
      });
    } else if (this.qrScanPurpose() === 'user_confirm_delivery' && this.qrScanShipmentId()) {
      this.shipmentService.markAsUserDelivered(this.qrScanShipmentId()!, uuid).subscribe({
        next: (response) => {
          if (response.success && response.info) {
            this.qrScanState.set('info');
            this.qrScanMessage.set(response.message || 'No update performed');
            this.qrScanInfoShipment.set(response.data?.shipment ?? null);
          } else if (response.success) {
            this.qrScanState.set('success');
            this.qrScanMessage.set(response.message || 'Delivery confirmed successfully');
            this.loadShipments();
          } else {
            this.qrScanState.set('error');
            this.qrScanMessage.set(response.message || 'Failed to confirm delivery');
          }
        },
        error: (err: any) => {
          this.qrScanState.set('error');
          this.qrScanMessage.set(err?.error?.message || 'Something went wrong. Please try again.');
        }
      });
    } else {
      this.qrScanState.set('error');
      this.qrScanMessage.set('Invalid scan configuration.');
    }
  }

  resetQrScanner(): void {
    this.scanHandled = false;
    this.qrScanState.set('idle');
    this.qrScanMessage.set('');
    this.qrScanCameraError.set(null);
    this.qrScanInfoShipment.set(null);
  }

  // Delivery scan modal (text-based fallback)
  openDeliveryScanModal(shipment: Shipment): void {
    this.deliveryScanShipment.set(shipment);
    this.deliveryScanModalOpen.set(true);
  }

  closeDeliveryScanModal(): void {
    this.deliveryScanModalOpen.set(false);
    this.deliveryScanShipment.set(null);
  }

  submitDeliveryScan(): void {
    const shipment = this.deliveryScanShipment();
    if (!shipment) return;

    this.deliveryScanLoading.set(true);
    this.shipmentService.markAsUserDelivered(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success(response.message || 'Delivery confirmed');
          this.closeDeliveryScanModal();
          this.loadShipments();
        } else {
          this.toastService.error(response.message || 'Failed to confirm delivery');
        }
        this.deliveryScanLoading.set(false);
      },
      error: (error: any) => {
        console.error('Failed to confirm delivery:', error);
        this.toastService.error('Failed to confirm delivery');
        this.deliveryScanLoading.set(false);
      }
    });
  }

  // Helper method to check if container has shipments
  hasContainerShipments(): boolean {
    const container = this.selectedContainer();
    return !!(container?.shipments && container.shipments.length > 0);
  }

  // Helper method to get container shipments
  getContainerShipments(): any[] {
    const container = this.selectedContainer();
    return container?.shipments || [];
  }

  // Action menu methods
  toggleActionMenu(shipmentId: string, event: Event): void {
    event.stopPropagation();
    const current = this.openActionMenuId();
    this.openActionMenuId.set(current === shipmentId ? null : shipmentId);
  }

  closeActionMenu(): void {
    this.openActionMenuId.set(null);
  }

  isActionMenuOpen(shipmentId: string): boolean {
    return this.openActionMenuId() === shipmentId;
  }

  // Additional info tooltip methods
  toggleInfo(shipmentId: string, event: Event): void {
    event.stopPropagation();
    const current = this.expandedInfoId();
    this.expandedInfoId.set(current === shipmentId ? null : shipmentId);
  }

  isInfoExpanded(shipmentId: string): boolean {
    return this.expandedInfoId() === shipmentId;
  }

  getAgentActionItems(shipment: Shipment): { label: string; icon: string; colorClass: string; action: () => void; disabled: boolean }[] {
    const items: { label: string; icon: string; colorClass: string; action: () => void; disabled: boolean }[] = [];

    if (this.canConfirm(shipment)) {
      items.push({ label: 'Confirm', icon: 'fa-check', colorClass: 'text-green-600 dark:text-green-400', action: () => this.confirmShipmentAction(shipment), disabled: this.isUpdating(shipment.id) });
      items.push({ label: 'Reject', icon: 'fa-times', colorClass: 'text-red-600 dark:text-red-400', action: () => this.rejectShipmentAction(shipment), disabled: this.isUpdating(shipment.id) });
    }
    if (this.canMarkAtWarehouse(shipment)) {
      items.push({ label: 'At Warehouse', icon: 'fa-warehouse', colorClass: 'text-indigo-600 dark:text-indigo-400', action: () => this.markAsAtWarehouseAction(shipment), disabled: this.isUpdating(shipment.id) });
    }
    if (this.canLoadToContainer(shipment)) {
      items.push({ label: 'Load to Container', icon: 'fa-dolly', colorClass: 'text-orange-600 dark:text-orange-400', action: () => this.openContainerModal(shipment), disabled: this.isUpdating(shipment.id) });
    }
    if (this.canRemoveFromContainer(shipment)) {
      items.push({ label: 'Remove from Container', icon: 'fa-arrow-left', colorClass: 'text-yellow-600 dark:text-yellow-400', action: () => this.removeShipmentFromContainer(shipment), disabled: this.isUpdating(shipment.id) });
    }
    if (this.canMarkInTransit(shipment)) {
      items.push({ label: 'In Transit', icon: 'fa-truck', colorClass: 'text-blue-600 dark:text-blue-400', action: () => this.markAsInTransitAction(shipment), disabled: this.isUpdating(shipment.id) });
    }
    if (this.canReturnToWarehouse(shipment)) {
      items.push({ label: 'Return to Warehouse', icon: 'fa-warehouse', colorClass: 'text-yellow-600 dark:text-yellow-400', action: () => this.returnToWarehouseAction(shipment), disabled: this.isUpdating(shipment.id) });
    }
    if (this.canCancel(shipment) && !this.canConfirm(shipment)) {
      items.push({ label: 'Cancel', icon: 'fa-times', colorClass: 'text-gray-600 dark:text-gray-400', action: () => this.cancelShipmentAction(shipment), disabled: this.isUpdating(shipment.id) });
    }
    if (this.canMarkDelivered(shipment)) {
      items.push({ label: 'Mark Delivered', icon: 'fa-check-double', colorClass: 'text-purple-600 dark:text-purple-400', action: () => this.markAsDeliveredAction(shipment), disabled: this.isUpdating(shipment.id) });
    }
    // Partially received: agent can add remaining quantity manually
    if (shipment.status === 'partially_received') {
      items.push({ label: 'Add Remaining Quantity', icon: 'fa-plus', colorClass: 'text-blue-600 dark:text-blue-400', action: () => this.openAddRemainingModal(shipment), disabled: this.isUpdating(shipment.id) });
    }

    return items;
  }

  // Partial receipt: client confirmation modal
  openPartialConfirmModal(shipment: Shipment): void {
    this.menuBarService.hide();
    this.partialConfirmShipment.set(shipment);
    this.partialConfirmModalOpen.set(true);
    this.partialConfirmLoading.set(false);
  }

  closePartialConfirmModal(): void {
    this.partialConfirmModalClosing.set(true);
    setTimeout(() => {
      this.partialConfirmModalOpen.set(false);
      this.partialConfirmModalClosing.set(false);
      this.partialConfirmShipment.set(null);
      this.partialConfirmLoading.set(false);
      this.menuBarService.show();
    }, 280);
  }

  submitPartialConfirm(): void {
    const shipment = this.partialConfirmShipment();
    if (!shipment) return;

    this.partialConfirmLoading.set(true);
    this.shipmentService.confirmPartialQuantity(shipment.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success(response.message);
          this.loadShipments();
          this.closePartialConfirmModal();
        } else {
          this.toastService.error(response.message || 'Failed to confirm');
          this.partialConfirmLoading.set(false);
        }
      },
      error: (error: any) => {
        console.error('Failed to confirm partial quantity:', error);
        this.toastService.error('Failed to confirm partial quantity');
        this.partialConfirmLoading.set(false);
      }
    });
  }

  // Partial receipt: agent add remaining quantity modal
  openAddRemainingModal(shipment: Shipment): void {
    this.menuBarService.hide();
    this.addRemainingShipment.set(shipment);
    this.addRemainingQuantityInput.set(null);
    this.addRemainingError.set('');
    this.addRemainingLoading.set(false);
    this.addRemainingModalOpen.set(true);
  }

  closeAddRemainingModal(): void {
    this.addRemainingModalClosing.set(true);
    setTimeout(() => {
      this.addRemainingModalOpen.set(false);
      this.addRemainingModalClosing.set(false);
      this.addRemainingShipment.set(null);
      this.addRemainingQuantityInput.set(null);
      this.addRemainingError.set('');
      this.addRemainingLoading.set(false);
      this.menuBarService.show();
    }, 280);
  }

  onAddRemainingInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    this.addRemainingQuantityInput.set(isNaN(val) ? null : val);
    this.addRemainingError.set('');
  }

  submitAddRemainingQuantity(): void {
    const shipment = this.addRemainingShipment();
    const qty = this.addRemainingQuantityInput();
    if (!shipment) return;

    if (qty === null || qty === undefined || qty < 1 || isNaN(qty)) {
      this.addRemainingError.set('Please enter a valid quantity (1 or more)');
      return;
    }

    // Validate against remaining
    const expected = this.getExpectedQuantity(shipment);
    const received = shipment.received_quantity ?? 0;
    const remaining = expected - received;
    if (qty > remaining) {
      this.addRemainingError.set(`Cannot exceed remaining quantity (${remaining})`);
      return;
    }

    this.addRemainingError.set('');
    this.addRemainingLoading.set(true);

    this.shipmentService.addReceivedQuantity(shipment.id, qty).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success(response.message);
          this.loadShipments();
          this.closeAddRemainingModal();
        } else {
          this.toastService.error(response.message || 'Failed to add quantity');
          this.addRemainingLoading.set(false);
        }
      },
      error: (error: any) => {
        console.error('Failed to add received quantity:', error);
        this.toastService.error('Failed to add received quantity');
        this.addRemainingLoading.set(false);
      }
    });
  }
}
