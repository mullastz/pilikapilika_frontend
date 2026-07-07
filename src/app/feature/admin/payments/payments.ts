import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './payments.html',
})
export class AdminPayments implements OnInit {
  payments = signal<any[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = 15;

  searchQuery = '';
  statusFilter = '';

  stats = signal({
    total_amount: 0,
    pending_count: 0,
    paid_count: 0,
    total_commission: 0,
  });

  modalOpen = signal(false);
  modalMode = signal<'create' | 'edit'>('create');
  selectedPayment = signal<any>(this.emptyPayment());

  methods = ['cash', 'bank_transfer', 'mobile_money', 'card', 'other'];
  statuses = ['pending', 'paid', 'failed', 'refunded'];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadPayments();
  }

  emptyPayment(): any {
    return {
      shipment_id: '',
      payer_id: null,
      payee_id: null,
      amount: 0,
      currency: 'TZS',
      method: 'cash',
      status: 'pending',
      transaction_reference: '',
      admin_note: '',
    };
  }

  loadPayments(): void {
    this.loading.set(true);
    this.adminService.getPayments({
      page: this.currentPage(),
      per_page: this.perPage,
      search: this.searchQuery || undefined,
      status: this.statusFilter || undefined,
    }).subscribe({
      next: (res: any) => {
        const paginator = res.data || { data: [], current_page: 1, last_page: 1, total: 0 };
        this.payments.set(paginator.data || []);
        this.currentPage.set(paginator.current_page || 1);
        this.lastPage.set(paginator.last_page || 1);
        this.total.set(paginator.total || 0);
        this.stats.set(res.stats || this.stats());
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load payments');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadPayments();
  }

  onStatusChange(): void {
    this.currentPage.set(1);
    this.loadPayments();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadPayments();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadPayments();
    }
  }

  fullName(user: any): string {
    if (!user) return '-';
    const name = `${user.firstname || ''} ${user.lastname || ''}`.trim();
    return name || user.username || user.email || `User #${user.id}`;
  }

  shipmentLabel(shipment: any): string {
    if (!shipment) return '-';
    return shipment.tracking_number || shipment.id?.slice(0, 8) + '...' || '-';
  }

  statusBadge(status: string): { text: string; class: string } {
    switch (status) {
      case 'paid':
        return { text: 'Paid', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
      case 'failed':
        return { text: 'Failed', class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
      case 'refunded':
        return { text: 'Refunded', class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
      default:
        return { text: 'Pending', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
    }
  }

  openCreate(): void {
    this.selectedPayment.set(this.emptyPayment());
    this.modalMode.set('create');
    this.modalOpen.set(true);
  }

  openEdit(payment: any): void {
    this.adminService.getPayment(payment.id).subscribe({
      next: (res: any) => {
        this.selectedPayment.set({ ...res });
        this.modalMode.set('edit');
        this.modalOpen.set(true);
      },
      error: () => this.toastService.error('Failed to load payment')
    });
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.selectedPayment.set(this.emptyPayment());
  }

  savePayment(): void {
    const payment = this.selectedPayment();
    const payload = {
      shipment_id: payment.shipment_id || null,
      payer_id: payment.payer_id ? Number(payment.payer_id) : null,
      payee_id: payment.payee_id ? Number(payment.payee_id) : null,
      amount: Number(payment.amount),
      currency: payment.currency || 'TZS',
      method: payment.method || null,
      status: payment.status,
      transaction_reference: payment.transaction_reference || null,
      admin_note: payment.admin_note || null,
    };

    if (payload.amount <= 0) {
      this.toastService.error('Amount must be greater than 0');
      return;
    }

    if (this.modalMode() === 'create') {
      this.adminService.createPayment(payload).subscribe({
        next: () => {
          this.toastService.success('Payment created');
          this.closeModal();
          this.loadPayments();
        },
        error: () => this.toastService.error('Failed to create payment')
      });
    } else {
      this.adminService.updatePayment(payment.id, payload).subscribe({
        next: () => {
          this.toastService.success('Payment updated');
          this.closeModal();
          this.loadPayments();
        },
        error: () => this.toastService.error('Failed to update payment')
      });
    }
  }

  deletePayment(payment: any): void {
    if (!confirm(`Delete payment #${payment.id}?`)) return;
    this.adminService.deletePayment(payment.id).subscribe({
      next: () => {
        this.toastService.success('Payment deleted');
        this.loadPayments();
      },
      error: () => this.toastService.error('Failed to delete payment')
    });
  }
}
