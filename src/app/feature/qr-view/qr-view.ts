import { Component, OnInit, ChangeDetectorRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { QrCodeService } from '../../core/services/qr-code.service';
import { AuthService } from '../../core/services/auth.service';
import { QRCodeComponent } from 'angularx-qrcode';
import jsPDF from 'jspdf';

interface AgentDetails {
  uuid: string;
  firstname: string;
  lastname: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  region: string | null;
  district: string | null;
  base_price: string | null;
  currency: string;
  is_verified: boolean;
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

  // ── PDF download ────────────────────────────────────────────────

  async downloadQR() {
    if (this.isDownloading || !this.qrData) return;
    this.isDownloading = true;
    this.cdr.detectChanges();

    try {
      const canvas = document.querySelector('qrcode canvas') as HTMLCanvasElement;
      if (!canvas) throw new Error('QR canvas not found');

      const qrDataUrl = canvas.toDataURL('image/png');
      const currentUser = this.authService.getUser();
      const agent = this.qrData.agent;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      // ── Header bar ──
      doc.setFillColor(249, 115, 22);
      doc.rect(0, 0, pageW, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('PilikaPilika — Product QR Code', margin, 12);
      y = 26;

      // ── QR code image ──
      const qrSize = 50;
      doc.addImage(qrDataUrl, 'PNG', (pageW - qrSize) / 2, y, qrSize, qrSize);
      y += qrSize + 4;
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(this.qrData.qr_data || '', pageW / 2, y, { align: 'center' });
      y += 8;

      // ── Section helper ──
      const drawSection = (title: string, rows: [string, string][]) => {
        const filled = rows.filter(([, v]) => !!v);
        if (!filled.length) return;
        doc.setFillColor(255, 237, 213);
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(194, 65, 12);
        doc.text(title, margin + 2, y + 5);
        y += 9;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        filled.forEach(([label, value], i) => {
          const bg = i % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.rect(margin, y, contentW, 6.5, 'F');
          doc.setTextColor(107, 114, 128);
          doc.text(label, margin + 2, y + 4.5);
          doc.setTextColor(17, 24, 39);
          doc.text(String(value), margin + 45, y + 4.5);
          y += 6.5;
        });
        y += 4;
      };

      // ── Product Details ──
      drawSection('Product Details', [
        ['Product Name',  this.qrData.product_name],
        ['Description',   this.qrData.description || ''],
        ['Category',      this.qrData.category || ''],
        ['Package Type',  this.qrData.package_type || ''],
        ['Quantity',      this.qrData.quantity ? String(this.qrData.quantity) : ''],
        ['Total Weight',  this.qrData.total_weight ? `${this.qrData.total_weight} kg` : ''],
        ['Total Volume',  this.qrData.total_volume ? `${this.qrData.total_volume} m³` : ''],
      ]);

      // ── Agent Details ──
      if (agent) {
        drawSection('Assigned Agent', [
          ['Name',     `${agent.firstname || ''} ${agent.lastname || ''}`.trim()],
          ['Email',    agent.email || ''],
          ['Phone',    agent.phone || ''],
          ['Location', this.getAgentLocation(agent)],
          ['Address',  agent.address || ''],
        ]);
      }

      // ── Customer Details ──
      if (currentUser) {
        drawSection('Customer Details', [
          ['Name',  `${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim()],
          ['Email', currentUser.email || ''],
          ['Phone', currentUser.phone || ''],
        ]);
      }

      // ── Footer ──
      doc.setFillColor(249, 115, 22);
      doc.rect(0, pageH - 10, pageW, 10, 'F');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on ${new Date().toLocaleDateString()} · PilikaPilika`, pageW / 2, pageH - 4, { align: 'center' });

      const safeName = (this.qrData.product_name || 'product')
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
