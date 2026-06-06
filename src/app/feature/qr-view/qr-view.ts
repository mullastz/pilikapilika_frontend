import { Component, OnInit, ChangeDetectorRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { QrCodeService } from '../../core/services/qr-code.service';
import { AuthService } from '../../core/services/auth.service';
import { QRCodeComponent } from 'angularx-qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface AgentDetails {
  uuid: string;
  firstname: string;
  lastname: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  region: string | null;
  district: string | null;
  country: string | null;
  base_price: string | null;
  currency: string;
  is_verified: boolean;
}

interface AgentAddress {
  id: number;
  label: string;
  address_line: string;
  is_default: boolean;
}

interface CustomerDetails {
  uuid: string;
  firstname: string;
  lastname: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  region: string | null;
  district: string | null;
  country: string | null;
}

interface QrCodeData {
  uuid: string;
  product_name: string;
  product_cost: string | null;
  currency: string | null;
  description: string | null;
  category: string | null;
  package_type: string | null;
  quantity: number | null;
  total_weight: string | null;
  total_volume: string | null;
  assigned_agent_uuid: string | null;
  agent: AgentDetails | null;
  agent_address: AgentAddress | null;
  customer: CustomerDetails | null;
  photos: string[] | null;
  qr_data: string;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-qr-view',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './qr-view.html',
  styleUrl: './qr-view.css',
  schemas: [NO_ERRORS_SCHEMA],
})
export class QrView implements OnInit {
  qrData: QrCodeData | null = null;
  isLoading = true;
  isDownloading = false;
  isSharing = false;
  errorMessage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private qrCodeService: QrCodeService,
    private authService: AuthService,
    private location: Location,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (!uuid) {
      this.errorMessage = 'Invalid QR code link.';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.qrCodeService.getByUuid(uuid).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.qrData = res?.data ?? null;
        if (!this.qrData) this.errorMessage = 'QR code details not found.';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message ?? 'Unable to load QR code details. Please try again later.';
        this.cdr.detectChanges();
      },
    });
  }

  goBack() { this.location.back(); }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString();
  }

  formatWithCommas(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(num)) return String(value);
    return num.toLocaleString('en-US');
  }

  getAgentLocation(agent: AgentDetails): string {
    return [agent.district, agent.region].filter(Boolean).join(', ') || '';
  }

  // ── PDF generation (shared) ───────────────────────────────────

  private async buildPdf(): Promise<{ doc: jsPDF; filename: string; cleanup: () => void }> {
    if (!this.qrData) throw new Error('No QR data available');

    const canvas = document.querySelector('qrcode canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('QR canvas not found');

    const qrDataUrl = canvas.toDataURL('image/png');
    const agent = this.qrData.agent;

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
      ['Product Name', this.qrData.product_name],
      ['Description', this.qrData.description || ''],
      ['Category', this.qrData.category || ''],
      ['Package Type', this.qrData.package_type || ''],
      ['Quantity', this.qrData.quantity ? String(this.qrData.quantity) : ''],
      ['Total Weight', this.qrData.total_weight ? `${this.qrData.total_weight} kg` : ''],
      ['Total Volume', this.qrData.total_volume ? `${this.qrData.total_volume} m³` : ''],
    ];

    const agentRows: [string, string][] = agent ? [
      ['Name', `${agent.firstname || ''} ${agent.lastname || ''}`.trim()],
      ['Phone', agent.phone || ''],
      ['Address', this.qrData.agent_address ? (this.qrData.agent_address.address_line || '') : (agent.address || '')],
    ] : [];

    const addressRows: [string, string][] = [];

    const customer = this.qrData.customer;
    const customerRows: [string, string][] = customer ? [
      ['Name', `${customer.firstname || ''} ${customer.lastname || ''}`.trim()],
      ['Phone', customer.phone || ''],
      ['Country', customer.country || ''],
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

    const safeName = (this.qrData.product_name || 'product')
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
    if (this.isDownloading || this.isSharing || !this.qrData) return;
    this.isDownloading = true;
    this.cdr.detectChanges();

    try {
      const { doc, filename, cleanup } = await this.buildPdf();
      doc.save(filename);
      cleanup();
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      this.isDownloading = false;
      this.cdr.detectChanges();
    }
  }

  // ── PDF share (mobile native share sheet) ───────────────────────

  async sharePdf() {
    if (this.isSharing || this.isDownloading || !this.qrData) return;
    this.isSharing = true;
    this.cdr.detectChanges();

    try {
      const { doc, filename, cleanup } = await this.buildPdf();
      const pdfBlob = doc.output('blob');
      cleanup();

      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
      const shareData: ShareData = {
        title: 'Product QR Code',
        text: `Product: ${this.qrData.product_name}`,
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
        console.error('PDF share error:', err);
        alert('Failed to share PDF. Please try again.');
      }
    } finally {
      this.isSharing = false;
      this.cdr.detectChanges();
    }
  }

  // ── Share ───────────────────────────────────────────────────────

  shareQR() {
    const shareUrl = this.qrData?.qr_data || '';
    const shareText = `Product: ${this.qrData?.product_name}\nView details: ${shareUrl}`;
    if (navigator.share) {
      navigator.share({ title: 'Product QR Code', text: shareText, url: shareUrl })
        .catch(() => this.copyToClipboard());
    } else {
      this.copyToClipboard();
    }
  }

  private copyToClipboard() {
    navigator.clipboard.writeText(this.qrData?.qr_data || '').then(() => alert('QR code link copied to clipboard!'));
  }

  sendToAgent() {
    if (!this.qrData) return;
    this.router.navigate(['/messages'], {
      state: {
        productInfo: {
          product: { name: this.qrData.product_name, description: this.qrData.description, category: this.qrData.category },
          qrData: this.qrData.qr_data,
          qrUuid: this.qrData.uuid,
        },
      },
    });
  }
}
