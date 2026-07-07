import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-user-keys',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-keys.html',
  styleUrl: './user-keys.css'
})
export class AdminUserKeys implements OnInit {
  keys = signal<any[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(15);
  searchQuery = signal('');
  selectedKey = signal<any | null>(null);
  detailLoading = signal(false);

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadKeys();
  }

  loadKeys(): void {
    this.loading.set(true);
    this.adminService.getUserKeys({
      page: this.currentPage(),
      per_page: this.perPage(),
      search: this.searchQuery() || undefined,
    }).subscribe({
      next: (res: any) => {
        this.keys.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load user keys');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadKeys();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadKeys();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadKeys();
    }
  }

  onView(key: any): void {
    this.detailLoading.set(true);
    this.selectedKey.set(null);
    this.adminService.getUserKey(key.id).subscribe({
      next: (res: any) => {
        this.selectedKey.set(res.data || res);
        this.detailLoading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load key details');
        this.detailLoading.set(false);
      }
    });
  }

  closeDetail(): void {
    this.selectedKey.set(null);
  }

  copyKey(): void {
    const key = this.selectedKey();
    if (!key) return;
    const text = typeof key.public_key === 'string' ? key.public_key : JSON.stringify(key.public_key, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.success('Public key copied to clipboard');
    }).catch(() => {
      this.toastService.error('Failed to copy public key');
    });
  }
}
