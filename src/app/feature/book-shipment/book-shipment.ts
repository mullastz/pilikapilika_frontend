import { Component, OnInit, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ShipmentService, BookShipmentRequest } from '../../core/services/shipment.service';
import { AuthService } from '../../core/services/auth.service';
import { AgentService } from '../../core/services/agent.service';
import { ToastService } from '../../core/services/toast.service';
import { PackageService } from '../../core/services/package.service';
import { QrCodeService } from '../../core/services/qr-code.service';

@Component({
  selector: 'app-book-shipment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './book-shipment.html',
  styleUrls: ['./book-shipment.css']
})
export class BookShipment implements OnInit {
  // Signals
  public loading = signal<boolean>(false);
  public submitting = signal<boolean>(false);
  public agentId = signal<string>('');
  public agent = signal<any>(null);
  public packages = signal<any[]>([]);
  public selectedPackages = signal<string[]>([]);
  public products = signal<any[]>([]);
  public selectedProducts = signal<any[]>([]);
  public showConfirmationModal = signal<boolean>(false);
  public bookedShipment = signal<any>(null);

  // Form signals
  public title = signal<string>('');
  public description = signal<string>('');
  public pickupAddress = signal<string>('');
  public destinationAddress = signal<string>('');
  public notes = signal<string>('');

  // Computed signals
  public hasSelectedItems = computed(() => 
    this.selectedPackages().length > 0 || this.selectedProducts().length > 0
  );

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private shipmentService: ShipmentService,
    private authService: AuthService,
    private agentService: AgentService,
    private toastService: ToastService,
    private packageService: PackageService,
    private qrCodeService: QrCodeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      this.toastService.error('Please login to book a shipment');
      this.router.navigate(['/sign-in'], { 
        queryParams: { returnUrl: this.router.url } 
      });
      return;
    }

    // Get agent ID from route params
    const agentId = this.route.snapshot.paramMap.get('agentId');
    if (!agentId) {
      this.toastService.error('Agent ID is required');
      this.router.navigate(['/']);
      return;
    }

    this.agentId.set(agentId);
    this.loadAgentData();
    this.loadUserPackages();
    this.loadUserProducts();
  }

  private loadAgentData(): void {
    this.loading.set(true);
    
    // Extract agent ID from the route parameter
    const agentIdParam = this.agentId();
    
    console.log('🔍 [DEBUG] Loading agent data...');
    console.log('🔍 [DEBUG] Agent ID from route:', agentIdParam);
    console.log('🔍 [DEBUG] Agent ID type:', typeof agentIdParam);
    console.log('🔍 [DEBUG] Agent ID length:', agentIdParam?.length);
    
    // Check if it's a UUID format (contains hyphens and longer than typical ID)
    const isUuid = agentIdParam.includes('-') && agentIdParam.length > 10;
    
    console.log('🔍 [DEBUG] Is UUID format:', isUuid);
    
    if (isUuid) {
      // For UUID strings, get all agents and find the matching one
      console.log('🔍 [DEBUG] Using UUID lookup method...');
      
      this.agentService.getAvailableAgents().subscribe({
        next: (agents: any[]) => {
          console.log('🔍 [DEBUG] Available agents loaded:', agents?.length);
          console.log('🔍 [DEBUG] Agents list:', agents.map(a => ({ id: a.id, uuid: a.uuid, name: `${a.firstname} ${a.lastname}` })));
          
          const foundAgent = agents.find(agent => {
            console.log('🔍 [DEBUG] Comparing with agent:', agent.uuid, '===', agentIdParam);
            return agent.uuid === agentIdParam;
          });
          
          console.log('🔍 [DEBUG] Found agent:', foundAgent ? 'YES' : 'NO');
          
          if (foundAgent) {
            console.log('✅ [DEBUG] Agent found successfully:', foundAgent);
            this.agent.set(foundAgent);
          } else {
            console.log('❌ [DEBUG] Agent NOT FOUND in list');
            this.toastService.error('Agent not found');
          }
          this.loading.set(false);
        },
        error: (error: any) => {
          console.log('❌ [DEBUG] Failed to load agents:', error);
          this.toastService.error('Failed to load agent information');
          this.loading.set(false);
          this.router.navigate(['/']);
        }
      });
    } else {
      // For numeric IDs, parse and use direct method
      const agentId = parseInt(agentIdParam);
      console.log('🔍 [DEBUG] Parsed numeric ID:', agentId);
      
      if (!isNaN(agentId)) {
        console.log('🔍 [DEBUG] Using numeric ID lookup method...');
        
        this.agentService.getPublicAgentProfile(agentId).subscribe({
          next: (agent: any) => {
            console.log('✅ [DEBUG] Agent loaded successfully:', agent);
            this.agent.set(agent);
            this.loading.set(false);
          },
          error: (error: any) => {
            console.log('❌ [DEBUG] Failed to load agent:', error);
            console.log('❌ [DEBUG] Error status:', error?.status);
            console.log('❌ [DEBUG] Error message:', error?.error?.message);
            this.toastService.error('Failed to load agent information');
            this.loading.set(false);
            this.router.navigate(['/']);
          }
        });
      } else {
        console.log('❌ [DEBUG] Invalid agent ID format');
        this.toastService.error('Invalid agent ID format');
        this.loading.set(false);
        this.router.navigate(['/']);
      }
    }
  }

  private loadUserPackages(): void {
    this.packageService.getAll().subscribe({
      next: (response: any) => {
        if (response?.data) {
          const packages = response.data;
          this.packages.set(packages);
        } else {
          this.packages.set([]);
        }
        this.loading.set(false);
      },
      error: (error: any) => {
        this.toastService.error('Failed to load packages');
        this.loading.set(false);
      }
    });
  }

  private loadUserProducts(): void {
    // Fetch real products using QrCodeService like my-products component
    this.qrCodeService.getAll().subscribe({
      next: (response: any) => {
        if (response?.data) {
          // Transform QR codes to product format for book-shipment
          const products = response.data.map((qrCode: any) => ({
            id: qrCode.uuid,
            name: qrCode.product_name,
            description: qrCode.description || '',
            price: parseFloat(qrCode.product_cost) || 0,
            currency: qrCode.currency || 'USD',
            photos: qrCode.photos || [],
            supplier_name: qrCode.supplier_name,
            supplier_phone: qrCode.supplier_phone
          }));
          
          this.products.set(products);
          
          // Trigger change detection to ensure template updates
          this.cdr.detectChanges();
        } else {
          this.products.set([]);
        }
        
        this.loading.set(false);
      },
      error: (error: any) => {
        this.toastService.error('Failed to load products');
        this.products.set([]);
        this.loading.set(false);
      }
    });
  }

  onPackageToggle(packageId: string): void {
    const current = this.selectedPackages();
    if (current.includes(packageId)) {
      this.selectedPackages.set(current.filter(id => id !== packageId));
    } else {
      this.selectedPackages.set([...current, packageId]);
    }
  }

  onProductToggle(product: any): void {
    const current = this.selectedProducts();
    const exists = current.find(p => p.id === product.id);
    if (exists) {
      this.selectedProducts.set(current.filter(p => p.id !== product.id));
    } else {
      this.selectedProducts.set([...current, product]);
    }
  }

  onSubmit(): void {
    console.log('📦 [BOOKING] Starting shipment booking process...');
    console.log('📦 [BOOKING] Form validation result:', this.validateForm());
    
    if (!this.validateForm()) {
      console.log('❌ [BOOKING] Form validation failed');
      return;
    }

    console.log('📦 [BOOKING] Form is valid, preparing request...');
    this.submitting.set(true);

    const request: BookShipmentRequest = {
      agent_id: this.agentId(),
      title: this.title(),
      description: this.description(),
      pickup_address: this.pickupAddress(),
      destination_address: this.destinationAddress(),
      products: this.selectedProducts(),
      packages: this.selectedPackages().map(id => 
        this.packages().find(p => p.uuid === id)
      ).filter(Boolean),
      notes: this.notes()
    };

    console.log('📦 [BOOKING] Request payload:', request);
    console.log('📦 [BOOKING] Selected products count:', this.selectedProducts().length);
    console.log('📦 [BOOKING] Selected packages count:', this.selectedPackages().filter(Boolean).length);

    this.shipmentService.bookShipment(request).subscribe({
      next: (response) => {
        console.log('📦 [BOOKING] API response received:', response);
        
        if (response.success) {
          console.log('✅ [BOOKING] Shipment booked successfully');
          console.log('📦 [BOOKING] Shipment details:', response.data.shipment);
          this.bookedShipment.set(response.data.shipment);
          this.showConfirmationModal.set(true);
          this.toastService.success('Shipment booked successfully!');
        } else {
          console.log('❌ [BOOKING] Booking failed:', response.message);
          this.toastService.error(response.message || 'Failed to book shipment');
        }
        this.submitting.set(false);
      },
      error: (error: any) => {
        console.log('❌ [BOOKING] API error:', error);
        console.log('❌ [BOOKING] Error status:', error?.status);
        console.log('❌ [BOOKING] Error message:', error?.error?.message);
        this.toastService.error('Failed to book shipment. Please try again.');
        this.submitting.set(false);
      }
    });
  }

  private validateForm(): boolean {
    if (!this.pickupAddress().trim()) {
      this.toastService.error('Please enter pickup address');
      return false;
    }

    if (!this.destinationAddress().trim()) {
      this.toastService.error('Please enter destination address');
      return false;
    }

    if (!this.hasSelectedItems()) {
      this.toastService.error('Please select at least one package or product');
      return false;
    }

    return true;
  }

  onGoToShipping(): void {
    this.showConfirmationModal.set(false);
    this.router.navigate(['/account/shipping']);
  }

  onCloseModal(): void {
    this.showConfirmationModal.set(false);
    this.router.navigate(['/account/shipping']);
  }

  goBack(): void {
    this.router.navigate(['/agent/' + this.agentId()]);
  }
}
