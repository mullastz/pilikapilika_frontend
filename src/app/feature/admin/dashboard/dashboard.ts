import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatCard } from '../../../shared/stat-card/stat-card';
import { AdminService, DashboardStats } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, StatCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class AdminDashboard implements OnInit {
  stats = signal<DashboardStats | null>(null);
  loading = signal(true);

  statCards = signal<{ icon: string; label: string; value: string; color: string }[]>([]);

  chartCanvas: HTMLCanvasElement | null = null;

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading.set(true);
    this.adminService.getDashboardStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        this.buildStatCards(data);
        setTimeout(() => this.drawCharts(data), 100);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load dashboard stats');
        this.loading.set(false);
      }
    });
  }

  buildStatCards(data: DashboardStats): void {
    this.statCards.set([
      { icon: 'fa-solid fa-users', label: 'Total Users', value: String(data.totals.users), color: 'bg-blue-500' },
      { icon: 'fa-solid fa-user-check', label: 'Verified Agents', value: String(data.totals.verified_agents), color: 'bg-green-500' },
      { icon: 'fa-solid fa-hourglass-half', label: 'Pending Verifications', value: String(data.totals.pending_verifications), color: 'bg-yellow-500' },
      { icon: 'fa-solid fa-box', label: 'Total Shipments', value: String(data.totals.packages), color: 'bg-purple-500' },
      { icon: 'fa-solid fa-qrcode', label: 'QR Codes', value: String(data.totals.qr_codes), color: 'bg-pink-500' },
      { icon: 'fa-solid fa-message', label: 'Messages', value: String(data.totals.messages), color: 'bg-cyan-500' },
    ]);
  }

  drawCharts(data: DashboardStats): void {
    this.chartCanvas = document.getElementById('signupsChart') as HTMLCanvasElement;
    if (!this.chartCanvas) return;
    const ctx = this.chartCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = this.chartCanvas.getBoundingClientRect();
    this.chartCanvas.width = rect.width * dpr;
    this.chartCanvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 20, bottom: 30, left: 40 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const signups = data.charts.signups_last_7_days;
    if (!signups || signups.length === 0) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', w / 2, h / 2);
      return;
    }

    const maxVal = Math.max(...signups.map(s => s.count), 1);
    const barWidth = cw / signups.length * 0.6;
    const gap = cw / signups.length * 0.4;

    // Grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + ch - (ch / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // Bars
    signups.forEach((item, i) => {
      const x = pad.left + i * (barWidth + gap) + gap / 2;
      const barH = (item.count / maxVal) * ch;
      const y = pad.top + ch - barH;

      // Bar
      ctx.fillStyle = '#FF7800';
      this.roundRect(ctx, x, y, barWidth, barH, 4);
      ctx.fill();

      // Value label
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(item.count), x + barWidth / 2, y - 6);

      // Date label
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      const dateStr = item.date.slice(5);
      ctx.fillText(dateStr, x + barWidth / 2, h - 10);
    });

    // Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxVal / 4) * i);
      const y = pad.top + ch - (ch / 4) * i + 4;
      ctx.fillText(String(val), pad.left - 6, y);
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
