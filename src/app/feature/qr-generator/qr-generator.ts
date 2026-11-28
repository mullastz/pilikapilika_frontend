import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { Subscription, retry } from 'rxjs';
import { QrCodeService, QrCodeResponse } from '../../core/services/qr-code.service';
import { AgentService } from '../../core/services/agent.service';
import { AgentFollowService } from '../../core/services/agent-follow.service';
import { AuthService } from '../../core/services/auth.service';
import { AddressService, Address, countryFlag } from '../../core/services/address.service';
import { transportLabel, transportIcon, TRANSPORT_CATALOG } from '../../core/utils/transport-methods.util';
import { Agent, User } from '../../core/interfaces/auth.interface';
import { UserService } from '../../core/services/user.service';
import { environment } from '../../../environments/environment';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ProductDetails {
  name: string;
  description: string;
  category: string;
  packageType: string;
  quantity: number | null;
  totalWeight: string;
  totalVolume: string;
}

@Component({
  selector: 'app-qr-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, QRCodeComponent],
  templateUrl: './qr-generator.html',
  styleUrl: './qr-generator.css',
})
export class QrGenerator implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('qrCodeSection') qrCodeSection!: ElementRef<HTMLDivElement>;

  constructor(
    private location: Location,
    private router: Router,
    private qrCodeService: QrCodeService,
    private agentService: AgentService,
    private authService: AuthService,
    private userService: UserService,
    private addressService: AddressService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private followService: AgentFollowService,
  ) {}

  ngOnInit() {
    this.checkEditMode();
    const preferred = this.route.snapshot.queryParamMap.get('agent');
    if (preferred && !this.route.snapshot.queryParamMap.get('edit')) {
      // Booking started from an agent's profile: the agent is fixed and other agents are never loaded.
      this.lockedAgentUuid = preferred;
      this.loadPreferredAgent(preferred);
    } else {
      this.loadAgents();
    }
  }

  /** Set when the booking was started with the Book button on an agent profile; that agent cannot be changed. */
  lockedAgentUuid: string | null = null;
  get isAgentLocked(): boolean { return this.lockedAgentUuid !== null; }

  product: ProductDetails = {
    name: '',
    description: '',
    category: '',
    packageType: '',
    quantity: null,
    totalWeight: '',
    totalVolume: '',
  };

  productPhotos: { file: File; preview: string; isExisting?: boolean }[] = [];
  removedExistingPhotos: string[] = [];
  generatedQR: string | null = null;
  showActions = false;
  isLoading = false;
  isDownloading = false;
  isSharing = false;
  errorMessage: string | null = null;
  qrUuid: string | null = null;
  editUuid: string | null = null;
  isEditMode = false;
  private pendingEditAgentUuid: string | null = null;

  // Agent assignment
  agents: Agent[] = [];
  agentSearchQuery = '';
  selectedAgent: Agent | null = null;
  isLoadingAgents = false;

  // Address selection
  addresses: Address[] = [];
  selectedAddress: Address | null = null;
  isLoadingAddresses = false;
  addressSearchQuery = '';
  showAddressDropdown = false;

  // Category dropdown
  categorySearchQuery = '';
  showCategoryDropdown = false;

  // Package type dropdown
  packageTypeSearchQuery = '';
  showPackageTypeDropdown = false;

  categories = [
    'Electronics', 'Fashion', 'Home Appliances', 'Toys',
    'Auto Parts', 'Beauty & Health', 'Sports', 'Books', 'Other',
  ];

  packageTypes = ['Box', 'Carton', 'Pallet', 'Envelope', 'Crate', 'Bag', 'Container'];

  // ── Agent selection (followed agents only, no search) ───────────

  /** Followed agents offering the chosen transport method. */
  get filteredAgents(): Agent[] {
    if (!this.selectedTransportMethod) return [];
    return this.agents.filter(a => (a.transport_methods || []).includes(this.selectedTransportMethod!));
  }

  get filteredCategories(): string[] {
    const q = this.categorySearchQuery.toLowerCase().trim();
    if (!q) return this.categories;
    return this.categories.filter(c => c.toLowerCase().includes(q));
  }

  get filteredPackageTypes(): string[] {
    const q = this.packageTypeSearchQuery.toLowerCase().trim();
    if (!q) return this.packageTypes;
    return this.packageTypes.filter(p => p.toLowerCase().includes(q));
  }

  /** Matching abroad addresses, sorted by country so the dropdown reads country by country. */
  get filteredAddresses(): Address[] {
    const q = this.addressSearchQuery.toLowerCase().trim();
    const matches = !q ? this.transportFilteredAddresses : this.transportFilteredAddresses.filter(a =>
      (a.label || '').toLowerCase().includes(q) ||
      (a.address_line || '').toLowerCase().includes(q) ||
      (a.country?.name || '').toLowerCase().includes(q),
    );
    return [...matches].sort((a, b) => (a.country?.name ?? '~').localeCompare(b.country?.name ?? '~'));
  }

  readonly countryFlag = countryFlag;

  /** Shows a country heading before the first address of each country in the dropdown. */
  startsCountryGroup(index: number): boolean {
    const list = this.filteredAddresses;
    return index === 0 || list[index].country?.id !== list[index - 1].country?.id;
  }

  get transportFilteredAddresses(): Address[] {
    if (!this.selectedTransportMethod) return [];
    return this.addresses.filter(a => this.addressMatchesTransport(a));
  }

  private addressMatchesTransport(address: Address): boolean {
    return !!this.selectedTransportMethod && !!address.transport_method &&
      address.transport_method.toLowerCase() === this.selectedTransportMethod.toLowerCase();
  }

  private autoSelectSingleAddress(): void {
    if (this.selectedAddress && this.addressMatchesTransport(this.selectedAddress)) return;
    const applicable = this.transportFilteredAddresses;
    this.selectedAddress = applicable.length === 1 ? applicable[0] : null;
    this.cdr.detectChanges();
  }

  preferredAgentError = '';

  lockedAgent: Agent | null = null;

  loadPreferredAgent(uuid: string): void {
    this.preferredAgentError = '';
    this.isLoadingAgents = true;
    this.agentService.getPublicAgentProfile(uuid).pipe(retry({ count: 2, delay: 800 })).subscribe({
      next: agent => {
        this.isLoadingAgents = false;
        this.agents = [agent];
        this.lockedAgent = agent;
        if (agent.availability_status !== 'available') { this.preferredAgentError = 'This agent is currently unavailable for new bookings.'; this.cdr.detectChanges(); return; }
        const methods = agent.transport_methods || [];
        if (methods.length === 1) this.selectedTransportMethod = methods[0];
        this.selectAgent(agent);
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingAgents = false;
        this.preferredAgentError = 'Unable to load the agent from your link. Check your connection and try again.';
        this.cdr.detectChanges();
      },
    });
  }

  agentsError = '';

  /**
   * Loads only the agents the user follows, for privacy: other marketplace agents are never requested.
   */
  loadAgents(): void {
    this.isLoadingAgents = true;
    this.agentsError = '';
    this.followService.list(1, 100).pipe(retry({ count: 2, delay: 800 })).subscribe({
      next: (response) => {
        const followed = response.data.agents;
        this.agents = this.selectedAgent && !followed.some(agent => agent.uuid === this.selectedAgent!.uuid) ? [this.selectedAgent, ...followed] : followed;
        this.isLoadingAgents = false;
        if (this.pendingEditAgentUuid) {
          const uuid = this.pendingEditAgentUuid;
          this.pendingEditAgentUuid = null;
          const found = this.agents.find((a) => a.uuid === uuid);
          if (found) {
            this.selectedAgent = found;
            this.loadAgentAddresses(found.uuid);
            this.reconcileAssignment();
          } else {
            this.loadEditAssignedAgent(uuid);
          }
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingAgents = false;
        this.agentsError = "Couldn't load the agents you follow.";
        this.cdr.detectChanges();
      },
    });
  }

  /** A parcel being edited keeps its existing agent even if the user no longer follows them. */
  private loadEditAssignedAgent(uuid: string): void {
    this.agentService.getPublicAgentProfile(uuid).subscribe({
      next: agent => {
        if (!this.agents.some(item => item.uuid === agent.uuid)) this.agents = [agent, ...this.agents];
        this.selectedAgent = agent;
        this.loadAgentAddresses(agent.uuid);
        this.reconcileAssignment();
        this.cdr.detectChanges();
      },
      error: () => this.cdr.detectChanges(),
    });
  }

  selectAgent(agent: any): void {
    if (this.isAgentLocked && agent?.uuid !== this.lockedAgentUuid) return;
    this.selectedAgent = agent;
    this.agentSearchQuery = '';
    this.clearAddress();
    this.loadAgentAddresses(agent.uuid);
  }

  clearAgent(): void {
    if (this.isAgentLocked) return;
    this.selectedAgent = null;
    this.selectedAddress = null;
    this.agentSearchQuery = '';
    this.cdr.detectChanges();
  }

  // ── Transport method selection ──────────────────────────────────

  /** Transport options offered by any of the loaded agents */
  get availableTransportOptions(): { value: string; label: string; icon: string }[] {
    const values = new Set<string>();
    this.agents.forEach(a => (a.transport_methods || []).forEach(v => values.add(v)));
    return [...values].map(v =>
      TRANSPORT_CATALOG.find(o => o.value === v) || { value: v, label: v, icon: 'fa-solid fa-truck-fast' }
    );
  }

  selectTransportMethod(value: string): void {
    this.selectedTransportMethod = value;
    if (this.selectedAgent && !(this.selectedAgent.transport_methods || []).includes(value)) {
      this.selectedAgent = null;
      this.selectedAddress = null;
      this.agentSearchQuery = '';
    } else {
      this.autoSelectSingleAddress();
    }
    this.cdr.detectChanges();
  }

  private reconcileAssignment(): void {
    if (this.selectedAgent && this.selectedTransportMethod &&
        !(this.selectedAgent.transport_methods || []).includes(this.selectedTransportMethod)) {
      this.selectedAgent = null;
      this.selectedAddress = null;
      return;
    }
    this.autoSelectSingleAddress();
  }

  getAgentLocation(agent: Agent): string {
    const parts = [agent.district, agent.region].filter(v => !!v);
    return parts.length ? parts.join(', ') : 'Location not set';
  }

  addressesError = '';
  private addressRequest: Subscription | null = null;

  /**
   * Loads the selected agent's receiving addresses. Only the latest request may update the list,
   * so a slow response for a previously selected agent can never replace the current agent's addresses.
   * Transient failures are retried before showing a retry button.
   */
  loadAgentAddresses(agentUuid: string): void {
    this.addressRequest?.unsubscribe();
    this.isLoadingAddresses = true;
    this.addressesError = '';
    this.addresses = [];
    // Goods are received abroad and shipped to Tanzania, so only the agent's abroad addresses apply.
    this.addressRequest = this.addressService.getAddressesByUserUuid(agentUuid, 'abroad')
      .pipe(retry({ count: 2, delay: 800 }))
      .subscribe({
        next: (response) => {
          if (this.selectedAgent?.uuid !== agentUuid) return;
          this.addresses = (response.data || []).filter(address => address.address_type === 'abroad');
          this.isLoadingAddresses = false;
          this.autoSelectSingleAddress();
          this.cdr.detectChanges();
        },
        error: () => {
          if (this.selectedAgent?.uuid !== agentUuid) return;
          this.isLoadingAddresses = false;
          this.addressesError = "Couldn't load this agent's addresses.";
          this.cdr.detectChanges();
        },
      });
  }

  retryAgentAddresses(): void {
    if (this.selectedAgent) this.loadAgentAddresses(this.selectedAgent.uuid);
  }

  // ── Category dropdown ───────────────────────────────────────────

  onCategoryFocus(): void {
    this.showCategoryDropdown = true;
  }

  onCategoryBlur(): void {
    setTimeout(() => {
      this.showCategoryDropdown = false;
      this.cdr.detectChanges();
    }, 200);
  }

  selectCategory(category: string): void {
    this.product.category = category;
    this.categorySearchQuery = '';
    this.showCategoryDropdown = false;
    this.cdr.detectChanges();
  }

  clearCategory(): void {
    this.product.category = '';
    this.categorySearchQuery = '';
    this.cdr.detectChanges();
  }

  // ── Package type dropdown ───────────────────────────────────────

  onPackageTypeFocus(): void {
    this.showPackageTypeDropdown = true;
  }

  onPackageTypeBlur(): void {
    setTimeout(() => {
      this.showPackageTypeDropdown = false;
      this.cdr.detectChanges();
    }, 200);
  }

  selectPackageType(type: string): void {
    this.product.packageType = type;
    this.packageTypeSearchQuery = '';
    this.showPackageTypeDropdown = false;
    this.cdr.detectChanges();
  }

  clearPackageType(): void {
    this.product.packageType = '';
    this.packageTypeSearchQuery = '';
    this.cdr.detectChanges();
  }

  // ── Address dropdown ────────────────────────────────────────────

  onAddressFocus(): void {
    if (!this.selectedAgent) return;
    this.showAddressDropdown = true;
  }

  onAddressBlur(): void {
    setTimeout(() => {
      this.showAddressDropdown = false;
      this.cdr.detectChanges();
    }, 200);
  }

  selectAddress(address: Address): void {
    this.selectedAddress = address;
    this.addressSearchQuery = '';
    this.showAddressDropdown = false;
    this.cdr.detectChanges();
  }

  transportLabel = transportLabel;
  transportIcon = transportIcon;

  selectedTransportMethod: string | null = null;

  clearAddress(): void {
    this.selectedAddress = null;
    this.cdr.detectChanges();
  }

  // ── Photos ──────────────────────────────────────────────────────

  onPhotoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const remainingSlots = Math.max(0, 12 - this.productPhotos.length);
    const errors: string[] = [];
    if (files.length > remainingSlots) errors.push(`You can upload at most 12 images. Only the first ${remainingSlots} will be added.`);
    for (const file of files.slice(0, remainingSlots)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        errors.push(`${file.name}: choose a JPG, PNG or WEBP image.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name}: each image must not exceed 5MB.`);
        continue;
      }
      const photo = { file, preview: '' };
      this.productPhotos.push(photo);
      const reader = new FileReader();
      reader.onload = () => {
        photo.preview = String(reader.result || '');
        this.cdr.detectChanges();
      };
      reader.onerror = () => {
        this.productPhotos = this.productPhotos.filter(item => item !== photo);
        this.errorMessage = `Unable to read ${file.name}. Please select it again.`;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
    this.errorMessage = errors.length ? errors.join(' ') : null;
    input.value = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  removePhoto(index: number) {
    const photo = this.productPhotos[index];
    this.queueExistingPhotoRemoval(photo);
    this.productPhotos.splice(index, 1);
  }

  clearAllPhotos() {
    this.productPhotos.forEach((photo) => this.queueExistingPhotoRemoval(photo));
    this.productPhotos = [];
  }

  private queueExistingPhotoRemoval(photo: { preview: string; isExisting?: boolean }): void {
    if (!photo.isExisting || !photo.preview || photo.preview.startsWith('data:') ||
        photo.preview.startsWith('blob:') || this.removedExistingPhotos.includes(photo.preview)) return;
    this.removedExistingPhotos.push(photo.preview);
  }

  // ── QR generation ───────────────────────────────────────────────

  generateQR() {
    if (!this.isFormValid() || this.isLoading) return;
    this.isLoading = true;
    this.errorMessage = null;

    const formData = new FormData();
    formData.append('product_name', this.product.name.trim());

    if (this.product.description.trim()) formData.append('description', this.product.description.trim());
    if (this.product.category)          formData.append('category', this.product.category);
    if (this.product.packageType)       formData.append('package_type', this.product.packageType);
    if (this.product.quantity !== null && this.product.quantity > 0)
      formData.append('quantity', String(this.product.quantity));
    if (this.product.totalWeight.trim()) formData.append('total_weight', this.product.totalWeight.trim());
    if (this.product.totalVolume.trim()) formData.append('total_volume', this.product.totalVolume.trim());
    if (this.selectedAgent)             formData.append('assigned_agent_uuid', this.selectedAgent.uuid);
    if (this.selectedAddress)           formData.append('agent_address_id', String(this.selectedAddress.id));
    if (this.selectedTransportMethod)   formData.append('transport_method', this.selectedTransportMethod);

    this.productPhotos.forEach((photo) => {
      if (photo.file.size > 0) formData.append('photos[]', photo.file);
    });
    this.removedExistingPhotos.forEach((url) => formData.append('removed_photos[]', url));

    const handleSuccess = (qrData: string, uuid: string) => {
      this.isLoading = false;
      this.qrUuid = uuid;
      this.generatedQR = qrData;
      this.showActions = true;
      this.cdr.detectChanges();
      setTimeout(() => this.scrollToQRCode(), 300);
    };

    const handleError = (err: HttpErrorResponse) => {
      this.isLoading = false;
      const validationErrors: unknown[] = Object.values(err.error?.errors || {}).flat();
      const firstError = validationErrors.find((value): value is string => typeof value === 'string');
      const msg = err.status === 413
        ? 'The selected photos exceed the server upload limit. Use fewer or smaller photos and try again.'
        : firstError || err.error?.message || 'Failed to save QR code. Please try again.';
      setTimeout(() => { this.errorMessage = msg; this.cdr.detectChanges(); });
    };

    const buildUrl = (origin: string, uuid: string) => {
      const appUrl = /localhost|127\.0\.0\.1/.test(origin)
        ? environment.apiUrl.replace('/api/v1', '').replace(':8000', ':4200')
        : origin;
      return `${appUrl}/qr/${uuid}`;
    };

    if (this.editUuid) {
      this.qrCodeService.update(this.editUuid, formData).subscribe({
        next: (response: any) => {
          const qrData = response.data?.qr_code || response.data;
          handleSuccess(buildUrl(window.location.origin, qrData.uuid), qrData.uuid);
        },
        error: handleError,
      });
    } else {
      this.qrCodeService.store(formData).subscribe({
        next: (response: QrCodeResponse) => {
          handleSuccess(buildUrl(window.location.origin, response.data.qr_code.uuid), response.data.qr_code.uuid);
        },
        error: handleError,
      });
    }
  }

  isFormValid(): boolean {
    return (
      this.product.name.trim() !== '' &&
      this.selectedTransportMethod !== null &&
      this.selectedAgent !== null &&
      (this.selectedAgent.transport_methods || []).includes(this.selectedTransportMethod) &&
      this.selectedAddress !== null &&
      this.addressMatchesTransport(this.selectedAddress)
    );
  }

  getValidationMessage(): string {
    if (this.product.name.trim() === '') {
      return 'Please enter a product name to continue';
    }
    if (!this.selectedTransportMethod) {
      return 'Please choose a transport method for this shipment';
    }
    if (!this.selectedAgent) {
      return 'Please select an agent to handle this delivery';
    }
    if (!(this.selectedAgent.transport_methods || []).includes(this.selectedTransportMethod)) {
      return 'The selected agent does not offer the chosen transport method';
    }
    if (!this.selectedAddress) {
      return 'Please select an agent address for pickup';
    }
    if (!this.addressMatchesTransport(this.selectedAddress)) {
      return 'The selected address does not match the chosen transport method';
    }
    return '';
  }

  // ── PDF generation (shared) ───────────────────────────────────

  private async buildPdf(): Promise<{ doc: jsPDF; filename: string; cleanup: () => void }> {
    const canvas = document.querySelector('qrcode canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('QR canvas not found');

    const qrDataUrl = canvas.toDataURL('image/png');

    // Fetch fresh user profile to ensure country and other fields are up-to-date
    let currentUser: User | null = this.authService.getUser();
    try {
      const profileRes = await this.userService.getProfile().toPromise();
      if (profileRes?.data) {
        currentUser = profileRes.data;
        this.authService.saveUser(profileRes.data);
      }
    } catch {
      // fallback to cached user if API fails
    }

    const agent = this.selectedAgent;

    const escapeHtml = (str: string): string => {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const buildRows = (rows: [string, string][]) =>
      rows
        .filter(([, v]) => !!v)
        .map(([label, value], i) => {
          const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
          return `<tr style="background:${bg};">
            <td style="padding:5px 10px;color:#6b7280;width:40%;font-size:13px;">${escapeHtml(label)}</td>
            <td style="padding:5px 10px;color:#111111;font-size:13px;">${escapeHtml(value)}</td>
          </tr>`;
        })
        .join('');

    const buildSection = (title: string, rows: [string, string][]) => {
      const rowHtml = buildRows(rows);
      if (!rowHtml) return '';
      return `
        <div style="margin-bottom:14px;">
          <div style="background:#ffedd5;padding:6px 10px;font-weight:bold;font-size:13px;color:#c2410c;border-radius:4px 4px 0 0;">${escapeHtml(title)}</div>
          <table style="width:100%;border-collapse:collapse;">${rowHtml}</table>
        </div>`;
    };

    const productRows: [string, string][] = [
      ['Product Name', this.product.name],
      ['Package Type', this.product.packageType || ''],
      ['Quantity', this.product.quantity ? String(this.product.quantity) : ''],
    ];

    const agentRows: [string, string][] = agent
      ? [
          ['Name', `${agent.firstname || ''} ${agent.lastname || ''}`.trim()],
          ['Phone', agent.phone || ''],
          [
            'Address',
            this.selectedAddress ? this.selectedAddress.address_line || '' : agent.address || '',
          ],
        ]
      : [];

    const addressRows: [string, string][] = [];

    const customerRows: [string, string][] = currentUser
      ? [
          ['Name', `${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim()],
          ['Phone', currentUser.phone || ''],
          ['Country', currentUser.country || ''],
        ]
      : [];

    const htmlContent = `
      <div id="pdf-render-target" style="width:794px;font-family:'DejaVu Sans','Helvetica Neue',Helvetica,Arial,sans-serif;background:#fff;color:#111;">
        <div style="background:#f97316;padding:14px 24px;color:#fff;font-weight:bold;font-size:17px;">
          PilikaPilika — Product QR Code
        </div>
        <div style="text-align:center;padding:20px;">
          <img src="${qrDataUrl}" style="width:200px;height:200px;display:block;margin:0 auto;" />
        </div>
        <div style="padding:0 30px 20px;">
          ${buildSection('Product Details', productRows)}
          ${buildSection('Assigned Agent', agentRows)}
          ${buildSection('Agent Address', addressRows)}
          ${buildSection('Customer Details', customerRows)}
        </div>
        <div style="background:#f97316;padding:10px 20px;color:#fff;font-size:11px;text-align:center;">
          Generated on ${new Date().toLocaleDateString()} · PilikaPilika
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    const renderTarget = container.firstElementChild as HTMLElement;
    renderTarget.style.position = 'fixed';
    renderTarget.style.left = '-9999px';
    renderTarget.style.top = '0';
    document.body.appendChild(renderTarget);

    const hCanvas = await html2canvas(renderTarget, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });
    const imgData = hCanvas.toDataURL('image/jpeg', 0.85);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (hCanvas.height * pdfWidth) / hCanvas.width;

    doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'MEDIUM');

    const safeName = (this.product.name || 'product')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 80);

    const cleanup = () => {
      if (renderTarget.parentNode) {
        document.body.removeChild(renderTarget);
      }
    };

    return { doc, filename: `${safeName}.pdf`, cleanup };
  }

  // ── PDF download ────────────────────────────────────────────────

  async downloadQR() {
    if (this.isDownloading || this.isSharing) return;
    this.isDownloading = true;
    this.cdr.detectChanges();

    try {
      const { doc, filename, cleanup } = await this.buildPdf();
      doc.save(filename);
      cleanup();
    } catch (err) {
      alert('Failed to generate PDF. Please try again.');
    } finally {
      this.isDownloading = false;
      this.cdr.detectChanges();
    }
  }

  // ── PDF share (mobile native share sheet) ───────────────────────

  async sharePdf() {
    if (this.isSharing || this.isDownloading) return;
    this.isSharing = true;
    this.cdr.detectChanges();

    try {
      const { doc, filename, cleanup } = await this.buildPdf();
      const pdfBlob = doc.output('blob');
      cleanup();

      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
      const shareData: ShareData = {
        title: 'Product QR Code',
        text: `Product: ${this.product.name}`,
        files: [pdfFile],
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: try URL share, then clipboard
        this.shareQR();
      }
    } catch (err) {
      // User cancelled share or error occurred
      if ((err as Error)?.name !== 'AbortError') {
        alert('Failed to share PDF. Please try again.');
      }
    } finally {
      this.isSharing = false;
      this.cdr.detectChanges();
    }
  }

  // ── Share ───────────────────────────────────────────────────────

  shareQR() {
    const shareUrl = this.generatedQR || '';
    const shareText = `Product: ${this.product.name}\nView details: ${shareUrl}`;
    if (navigator.share) {
      navigator
        .share({ title: 'Product QR Code', text: shareText, url: shareUrl })
        .catch(() => this.copyToClipboard());
    } else {
      this.copyToClipboard();
    }
  }

  private copyToClipboard() {
    navigator.clipboard
      .writeText(this.generatedQR || '')
      .then(() => alert('QR code link copied to clipboard!'));
  }

  goBack() {
    this.location.back();
  }

  sendToAgent() {
    this.router.navigate(['/messages'], {
      state: {
        productInfo: { product: this.product, qrData: this.generatedQR, qrUuid: this.qrUuid },
      },
    });
  }

  checkEditMode() {
    const editUuid = this.route.snapshot.queryParamMap.get('edit');
    if (editUuid) {
      this.isEditMode = true;
      this.isLoading = true;
      this.editUuid = editUuid;
      this.loadQrCodeForEdit(editUuid);
    }
  }

  private loadQrCodeForEdit(uuid: string) {
    this.removedExistingPhotos = [];
    this.qrCodeService.getByUuid(uuid).subscribe({
      next: (response: any) => {
        const data = response?.data;
        if (!data) {
          this.isLoading = false;
          this.isEditMode = false;
          return;
        }

        this.product = {
          name: data.product_name || '',
          description: data.description || '',
          category: data.category || '',
          packageType: data.package_type || '',
          quantity: data.quantity,
          totalWeight: data.total_weight || '',
          totalVolume: data.total_volume || '',
        };

        if (data.photos?.length) {
          this.productPhotos = data.photos.map((url: string) => ({
            file: new File([], 'placeholder'),
            preview: url,
            isExisting: true,
          }));
        }

        // Restore selected transport method
        if (data.transport_method) {
          this.selectedTransportMethod = data.transport_method;
        }

        // Restore selected agent
        if (data.assigned_agent_uuid) {
          const foundAgent = this.agents.find((a) => a.uuid === data.assigned_agent_uuid);
          if (foundAgent) {
            this.selectedAgent = foundAgent;
            this.loadAgentAddresses(data.assigned_agent_uuid);
          } else {
            this.pendingEditAgentUuid = data.assigned_agent_uuid;
          }
        }

        // Restore selected agent address
        if (data.agent_address) {
          this.selectedAddress = data.agent_address;
        }

        this.reconcileAssignment();

        this.qrUuid = data.uuid;
        this.generatedQR = data.qr_data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.isEditMode = false;
      },
    });
  }

  resetForm() {
    this.removedExistingPhotos = [];
    this.product = {
      name: '',
      description: '',
      category: '',
      packageType: '',
      quantity: null,
      totalWeight: '',
      totalVolume: '',
    };
    this.productPhotos = [];
    this.generatedQR = null;
    this.showActions = false;
    this.errorMessage = null;
    this.qrUuid = null;
    this.editUuid = null;
    this.selectedTransportMethod = null;
    this.isEditMode = false;
    this.selectedAgent = null;
    this.selectedAddress = null;
    this.agentSearchQuery = '';
    // A booking started from an agent profile keeps that agent for the next parcel too.
    if (this.lockedAgent && this.lockedAgent.availability_status === 'available') {
      const methods = this.lockedAgent.transport_methods || [];
      if (methods.length === 1) this.selectedTransportMethod = methods[0];
      this.selectAgent(this.lockedAgent);
    }
  }

  formatWithCommas(value: string | number | null): string {
    if (value === null || value === undefined || value === '') return '';
    const str = String(value).replace(/,/g, '');
    const num = parseFloat(str);
    if (isNaN(num)) return String(value);
    return num.toLocaleString('en-US');
  }

  scrollToQRCode() {
    setTimeout(() => {
      if (this.qrCodeSection?.nativeElement) {
        this.qrCodeSection.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const el = document.getElementById('qrCodeSection');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  }
}
