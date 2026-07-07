import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reviews.html',
})
export class AdminReviews implements OnInit {
  reviews = signal<any[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = 15;

  searchQuery = '';
  statusFilter = '';

  modalOpen = signal(false);
  selectedReview = signal<any | null>(null);
  adminNote = '';

  selectedIds = signal<number[]>([]);
  bulkStatus = '';

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.loading.set(true);
    this.adminService.getReviews({
      page: this.currentPage(),
      per_page: this.perPage,
      search: this.searchQuery || undefined,
      status: this.statusFilter || undefined,
    }).subscribe({
      next: (res: any) => {
        this.reviews.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load reviews');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadReviews();
  }

  onStatusChange(): void {
    this.currentPage.set(1);
    this.loadReviews();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadReviews();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadReviews();
    }
  }

  fullName(user: any): string {
    if (!user) return '-';
    const name = `${user.firstname || ''} ${user.lastname || ''}`.trim();
    return name || user.username || user.email || `User #${user.id}`;
  }

  statusBadge(status: string): { text: string; class: string } {
    switch (status) {
      case 'approved':
        return { text: 'Approved', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
      case 'rejected':
        return { text: 'Rejected', class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
      default:
        return { text: 'Pending', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
    }
  }

  openView(review: any): void {
    this.adminService.getReview(review.id).subscribe({
      next: (res: any) => {
        this.selectedReview.set({ ...res });
        this.adminNote = res.admin_note || '';
        this.modalOpen.set(true);
      },
      error: () => this.toastService.error('Failed to load review')
    });
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.selectedReview.set(null);
    this.adminNote = '';
  }

  approveReview(): void {
    this.updateReviewStatus('approved');
  }

  rejectReview(): void {
    this.updateReviewStatus('rejected');
  }

  setStatus(review: any, status: string): void {
    this.adminService.updateReviewStatus(review.id, status).subscribe({
      next: () => {
        this.toastService.success(`Review ${status}`);
        this.loadReviews();
      },
      error: () => this.toastService.error(`Failed to ${status} review`)
    });
  }

  private updateReviewStatus(status: string): void {
    const review = this.selectedReview();
    if (!review) return;

    this.adminService.updateReviewStatus(review.id, status, this.adminNote).subscribe({
      next: () => {
        this.toastService.success(`Review ${status}`);
        this.closeModal();
        this.loadReviews();
      },
      error: () => this.toastService.error(`Failed to ${status} review`)
    });
  }

  deleteReview(review: any): void {
    if (!confirm(`Delete review #${review.id}?`)) return;
    this.adminService.deleteReview(review.id).subscribe({
      next: () => {
        this.toastService.success('Review deleted');
        this.loadReviews();
      },
      error: () => this.toastService.error('Failed to delete review')
    });
  }

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  toggleSelection(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.update(ids => {
      if (checked) {
        return ids.includes(id) ? ids : [...ids, id];
      }
      return ids.filter(i => i !== id);
    });
  }

  selectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.set(checked ? this.reviews().map(r => r.id) : []);
  }

  allSelected(): boolean {
    return this.reviews().length > 0 && this.reviews().every(r => this.selectedIds().includes(r.id));
  }

  applyBulk(): void {
    const ids = this.selectedIds();
    const status = this.bulkStatus;
    if (!ids.length || !status) {
      this.toastService.error('Select reviews and a status');
      return;
    }
    this.adminService.bulkUpdateReviewStatus(ids, status).subscribe({
      next: () => {
        this.toastService.success(`${ids.length} review(s) ${status}`);
        this.selectedIds.set([]);
        this.bulkStatus = '';
        this.loadReviews();
      },
      error: () => this.toastService.error('Bulk update failed')
    });
  }
}
