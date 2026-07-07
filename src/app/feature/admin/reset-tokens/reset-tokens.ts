import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-reset-tokens',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-tokens.html',
  styleUrl: './reset-tokens.css'
})
export class AdminResetTokens implements OnInit {
  tokens = signal<any[]>([]);
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
    this.loadTokens();
  }

  loadTokens(): void {
    this.loading.set(true);
    this.adminService.getPasswordResetTokens({
      page: this.currentPage(),
      per_page: this.perPage(),
      search: this.searchQuery() || undefined,
      used: this.usedFilter() !== '' ? this.usedFilter() === 'true' : undefined,
    }).subscribe({
      next: (res: any) => {
        this.tokens.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load password reset tokens');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadTokens();
  }

  onUsedChange(): void {
    this.currentPage.set(1);
    this.loadTokens();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadTokens();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadTokens();
    }
  }

  onRevoke(token: any): void {
    if (!confirm(`Revoke unused token for ${token.user?.email}?`)) return;
    this.adminService.deletePasswordResetToken(token.id).subscribe({
      next: () => {
        this.toastService.success('Token revoked');
        this.loadTokens();
      },
      error: () => this.toastService.error('Failed to revoke token')
    });
  }
}
