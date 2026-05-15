import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { QrCodeService, QrCodeResponse } from '../../core/services/qr-code.service';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { AddressService, Address } from '../../core/services/address.service';
import { Agent } from '../../core/interfaces/auth.interface';
import { environment } from '../../../environments/environment';
import jsPDF from 'jspdf';

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
    this.agentService.getAvailableAgents().subscribe({
      next: (agents) => {
        this.agents = agents;
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
      const currentUser = this.authService.getUser();
      const agent = this.selectedAgent;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      // ── Header bar ──
      doc.setFillColor(249, 115, 22); // orange-500
      doc.rect(0, 0, pageW, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('PilikaPilika — Product QR Code', margin, 12);
      y = 26;

      // ── QR code image (centred) ──
      const qrSize = 50;
      const qrX = (pageW - qrSize) / 2;
      doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
      y += qrSize + 4;

      // QR link below image
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      const qrLink = this.generatedQR || '';
      doc.text(qrLink, pageW / 2, y, { align: 'center' });
      y += 8;

      // ── Section helper ──
      const drawSection = (title: string, rows: [string, string][]) => {
        if (!rows.length) return;
        // Section title
        doc.setFillColor(255, 237, 213); // orange-100
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(194, 65, 12); // orange-700
        doc.text(title, margin + 2, y + 5);
        y += 9;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        rows.forEach(([label, value], i) => {
          if (!value) return;
          const bg = i % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.rect(margin, y, contentW, 6.5, 'F');
          doc.setTextColor(107, 114, 128); // gray-500
          doc.text(label, margin + 2, y + 4.5);
          doc.setTextColor(17, 24, 39); // gray-900
          doc.text(value, margin + 45, y + 4.5);
          y += 6.5;
        });
        y += 4;
      };

      // ── Product Details ──
      const productRows: [string, string][] = [
        ['Product Name', this.product.name],
        ['Description',  this.product.description || ''],
        ['Category',     this.product.category || ''],
        ['Package Type', this.product.packageType || ''],
        ['Quantity',     this.product.quantity ? String(this.product.quantity) : ''],
        ['Total Weight', this.product.totalWeight ? `${this.product.totalWeight} kg` : ''],
        ['Total Volume', this.product.totalVolume ? `${this.product.totalVolume} m³` : ''],
      ].filter(([, v]) => !!v) as [string, string][];
      drawSection('Product Details', productRows);

      // ── Agent Details ──
      if (agent) {
        const agentRows: [string, string][] = [
          ['Name',     `${agent.firstname || ''} ${agent.lastname || ''}`.trim()],
          ['Email',    agent.email || ''],
          ['Phone',    agent.phone || ''],
          ['Location', [agent.district, agent.region].filter(Boolean).join(', ')],
          ['Address',  agent.address || ''],
        ].filter(([, v]) => !!v) as [string, string][];
        drawSection('Assigned Agent', agentRows);
      }

      // ── Agent Address ──
      if (this.selectedAddress) {
        const addressRows: [string, string][] = [
          ['Address', this.selectedAddress.address_line || ''],
        ].filter(([, v]) => !!v) as [string, string][];
        drawSection('Agent Address', addressRows);
      }

      // ── Customer Details ──
      if (currentUser) {
        const customerRows: [string, string][] = [
          ['Name',  `${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim()],
          ['Email', currentUser.email || ''],
          ['Phone', currentUser.phone || ''],
        ].filter(([, v]) => !!v) as [string, string][];
        drawSection('Customer Details', customerRows);
      }

      // ── Footer ──
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFillColor(249, 115, 22);
      doc.rect(0, pageH - 10, pageW, 10, 'F');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on ${new Date().toLocaleDateString()} · PilikaPilika`, pageW / 2, pageH - 4, { align: 'center' });

      // Sanitise product name for use as filename (remove chars invalid in filenames)
      const safeName = (this.product.name || 'product')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 80);

      doc.save(`${safeName}.pdf`);
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
