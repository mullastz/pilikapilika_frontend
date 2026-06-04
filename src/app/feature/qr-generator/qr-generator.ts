import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { QrCodeService, QrCodeResponse } from '../../core/services/qr-code.service';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { AddressService, Address } from '../../core/services/address.service';
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
  ) {}

  ngOnInit() {
    this.checkEditMode();
    this.loadAgents();
    this.loadAddresses();
  }

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
  errorMessage: string | null = null;
  qrUuid: string | null = null;
  editUuid: string | null = null;
  isEditMode = false;

  // Agent assignment
  agents: Agent[] = [];
  agentSearchQuery = '';
  showAgentDropdown = false;
  selectedAgent: Agent | null = null;
  isLoadingAgents = false;

  // Address selection
  addresses: Address[] = [];
  selectedAddress: Address | null = null;
  isLoadingAddresses = false;

  categories = [
    'Electronics', 'Fashion', 'Home Appliances', 'Toys',
    'Auto Parts', 'Beauty & Health', 'Sports', 'Books', 'Other',
  ];

  packageTypes = ['Box', 'Carton', 'Pallet', 'Envelope', 'Crate', 'Bag', 'Container'];

  // ── Agent search ────────────────────────────────────────────────

  get filteredAgents(): Agent[] {
    const q = this.agentSearchQuery.toLowerCase().trim();
    if (!q) return this.agents;
    return this.agents.filter(a =>
      `${a.firstname} ${a.lastname}`.toLowerCase().includes(q) ||
      (a.region || '').toLowerCase().includes(q) ||
      (a.district || '').toLowerCase().includes(q),
    );
  }

  loadAgents(): void {
    this.isLoadingAgents = true;
    this.agentService.getAvailableAgents(1, 100).subscribe({
      next: (response) => {
        this.agents = response.agents;
        this.isLoadingAgents = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingAgents = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectAgent(agent: any): void {
    this.selectedAgent = agent;
    this.agentSearchQuery = '';
    this.clearAddress();
    this.loadAgentAddresses(agent.uuid);
  }

  clearAgent(): void {
    this.selectedAgent = null;
    this.selectedAddress = null;
    this.agentSearchQuery = '';
    this.cdr.detectChanges();
  }

  getAgentLocation(agent: Agent): string {
    const parts = [agent.district, agent.region].filter(v => !!v);
    return parts.length ? parts.join(', ') : 'Location not set';
  }

  loadAgentAddresses(agentUuid: string): void {
    this.isLoadingAddresses = true;
    this.addresses = [];
    this.addressService.getAddressesByUserUuid(agentUuid).subscribe({
      next: (response) => {
        this.addresses = response.data || [];
        this.isLoadingAddresses = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingAddresses = false;
        this.cdr.detectChanges();
      },
    });
  }

  onAgentSearchFocus(): void {
    this.showAgentDropdown = true;
  }

  onAgentSearchBlur(): void {
    // Delay so click on dropdown item registers first
    setTimeout(() => {
      this.showAgentDropdown = false;
      this.cdr.detectChanges();
    }, 200);
  }

  // ── Address loading ───────────────────────────────────────────────

  loadAddresses(): void {
    this.isLoadingAddresses = true;
    this.addressService.getAddresses().subscribe({
      next: (response) => {
        this.addresses = response.data || [];
        this.isLoadingAddresses = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingAddresses = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectAddress(address: Address): void {
    this.selectedAddress = address;
    this.cdr.detectChanges();
  }

  clearAddress(): void {
    this.selectedAddress = null;
    this.cdr.detectChanges();
  }

  // ── Photos ──────────────────────────────────────────────────────

  onPhotoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const remainingSlots = 12 - this.productPhotos.length;
      const filesToProcess = Math.min(input.files.length, remainingSlots);
      if (input.files.length > remainingSlots) {
        alert(`You can upload at most 12 images. Only the first ${filesToProcess} will be added.`);
      }
      for (let i = 0; i < filesToProcess; i++) {
        const file = input.files[i];
        if (!file.type.startsWith('image/')) continue;
        const reader = new FileReader();
        reader.onload = (e) => {
          this.productPhotos.push({ file, preview: e.target?.result as string });
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      }
    }
    input.value = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  removePhoto(index: number) {
    const photo = this.productPhotos[index];
    if (photo.isExisting && photo.preview) this.removedExistingPhotos.push(photo.preview);
    this.productPhotos.splice(index, 1);
  }

  clearAllPhotos() { this.productPhotos = []; }

  // ── QR generation ───────────────────────────────────────────────

  generateQR() {
    if (!this.isFormValid()) return;
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

    const handleError = (err: any) => {
      this.isLoading = false;
      const msg = err?.error?.message || err?.error?.errors?.photos?.[0] || 'Failed to save QR code. Please try again.';
      setTimeout(() => { this.errorMessage = msg; this.cdr.detectChanges(); });
    };

    const buildUrl = (origin: string, uuid: string) => {
      const appUrl = /localhost|127\.0\.0\.1/.test(origin)
        ? environment.apiUrl.replace('/api/v1', '').replace(':8000', ':4200')
        : origin;
      return `${appUrl}/qr/${uuid}`;
    };

    if (this.editUuid) {
      formData.append('_method', 'PUT');
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
    return this.product.name.trim() !== '';
  }

  // ── PDF download ────────────────────────────────────────────────

  async downloadQR() {
    if (this.isDownloading) return;
    this.isDownloading = true;
    this.cdr.detectChanges();

    try {
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
        ['Description', this.product.description || ''],
        ['Category', this.product.category || ''],
        ['Package Type', this.product.packageType || ''],
        ['Quantity', this.product.quantity ? String(this.product.quantity) : ''],
        ['Total Weight', this.product.totalWeight ? `${this.product.totalWeight} kg` : ''],
        ['Total Volume', this.product.totalVolume ? `${this.product.totalVolume} m³` : ''],
      ];

      const agentRows: [string, string][] = agent ? [
        ['Name', `${agent.firstname || ''} ${agent.lastname || ''}`.trim()],
        ['Phone', agent.phone || ''],
        ['Address', this.selectedAddress ? (this.selectedAddress.address_line || '') : (agent.address || '')],
      ] : [];

      const addressRows: [string, string][] = [];

      const customerRows: [string, string][] = currentUser ? [
        ['Name', `${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim()],
        ['Phone', currentUser.phone || ''],
        ['Country', currentUser.country || ''],
      ] : [];

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
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        logging: false
      });
      const imgData = hCanvas.toDataURL('image/png');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (hCanvas.height * pdfWidth) / hCanvas.width;

      doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      const safeName = (this.product.name || 'product')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 80);

      doc.save(`${safeName}.pdf`);
      document.body.removeChild(renderTarget);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      this.isDownloading = false;
      this.cdr.detectChanges();
    }
  }

  // ── Share ───────────────────────────────────────────────────────

  shareQR() {
    const shareUrl = this.generatedQR || '';
    const shareText = `Product: ${this.product.name}\nView details: ${shareUrl}`;
    if (navigator.share) {
      navigator.share({ title: 'Product QR Code', text: shareText, url: shareUrl })
        .catch(() => this.copyToClipboard());
    } else {
      this.copyToClipboard();
    }
  }

  private copyToClipboard() {
    navigator.clipboard.writeText(this.generatedQR || '').then(() => alert('QR code link copied to clipboard!'));
  }

  goBack() { this.location.back(); }

  sendToAgent() {
    this.router.navigate(['/messages'], {
      state: { productInfo: { product: this.product, qrData: this.generatedQR, qrUuid: this.qrUuid } },
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
        if (!data) { this.isLoading = false; this.isEditMode = false; return; }

        this.product = {
          name:        data.product_name || '',
          description: data.description  || '',
          category:    data.category     || '',
          packageType: data.package_type || '',
          quantity:    data.quantity,
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

        // Restore selected agent
        if (data.assigned_agent_uuid) {
          const foundAgent = this.agents.find(a => a.uuid === data.assigned_agent_uuid);
          if (foundAgent) {
            this.selectedAgent = foundAgent;
            this.loadAgentAddresses(data.assigned_agent_uuid);
          }
        }

        // Restore selected agent address
        if (data.agent_address) {
          this.selectedAddress = data.agent_address;
        }

        this.qrUuid = data.uuid;
        this.generatedQR = data.qr_data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; this.isEditMode = false; },
    });
  }

  resetForm() {
    this.product = { name: '', description: '', category: '', packageType: '', quantity: null, totalWeight: '', totalVolume: '' };
    this.productPhotos = [];
    this.generatedQR = null;
    this.showActions = false;
    this.errorMessage = null;
    this.qrUuid = null;
    this.editUuid = null;
    this.isEditMode = false;
    this.selectedAgent = null;
    this.selectedAddress = null;
    this.agentSearchQuery = '';
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
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  }
}
