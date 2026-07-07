import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-verifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verifications.html',
  styleUrl: './verifications.css'
})
export class AdminVerifications implements OnInit {
  verifications = signal<any[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(15);
  searchQuery = signal('');
  usedFilter = signal<string>('');

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadVerifications();
  }

  loadVerifications(): void {
    this.loading.set(true);
    this.adminService.getEmailVerifications({
      page: this.currentPage(),
      per_page: this.perPage(),
      search: this.searchQuery() || undefined,
      used: this.usedFilter() !== '' ? this.usedFilter() === 'true' : undefined,
    }).subscribe({
      next: (res: any) => {
        this.verifications.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load email verifications');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadVerifications();
  }

  onUsedChange(): void {
    this.currentPage.set(1);
    this.loadVerifications();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadVerifications();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadVerifications();
    }
  }

  onResend(verification: any): void {
    if (!confirm(`Resend verification email to ${verification.user?.email}?`)) return;
    this.adminService.resendEmailVerification(verification.id).subscribe({
      next: () => {
        this.toastService.success('Verification email resent');
        this.loadVerifications();
      },
      error: () => this.toastService.error('Failed to resend verification email')
    });
  }

  onVerifyManual(verification: any): void {
    if (!confirm(`Manually verify email for ${verification.user?.email}?`)) return;
    this.adminService.verifyEmailManual(verification.id).subscribe({
      next: () => {
        this.toastService.success('Email verified manually');
        this.loadVerifications();
      },
      error: () => this.toastService.error('Failed to verify email manually')
    });
  }
}
