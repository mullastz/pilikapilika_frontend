import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTable, TableColumn } from '../../../shared/data-table/data-table';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable],
  templateUrl: './logs.html',
  styleUrl: './logs.css'
})
export class AdminLogs implements OnInit {
  logs = signal<any[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  searchQuery = signal('');

  columns: TableColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'user.firstname', label: 'User', format: (v, row) => `${row.user?.firstname || ''} ${row.user?.lastname || ''}`.trim() || row.user?.username || row.email || '-' },
    { key: 'email', label: 'Email' },
    { key: 'loginType', label: 'Type' },
    { key: 'login_time', label: 'Login', format: (v) => v ? new Date(v).toLocaleString() : '-' },
    { key: 'logout_time', label: 'Logout', format: (v) => v ? new Date(v).toLocaleString() : 'Active' },
  ];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading.set(true);
    this.adminService.getLogs({
      page: this.currentPage(),
      search: this.searchQuery() || undefined,
    }).subscribe({
      next: (res: any) => {
        this.logs.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load logs');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadLogs();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadLogs();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadLogs();
    }
  }
}
