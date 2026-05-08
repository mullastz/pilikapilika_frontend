import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTable, TableColumn } from '../../../shared/data-table/data-table';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable],
  templateUrl: './messages.html',
  styleUrl: './messages.css'
})
export class AdminMessages implements OnInit {
  messages = signal<any[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  searchQuery = signal('');

  columns: TableColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'sender.firstname', label: 'From', format: (v, row) => `${row.sender?.firstname || ''} ${row.sender?.lastname || ''}`.trim() || row.sender?.username || '-' },
    { key: 'recipient.firstname', label: 'To', format: (v, row) => `${row.recipient?.firstname || ''} ${row.recipient?.lastname || ''}`.trim() || row.recipient?.username || '-' },
    { key: 'read_at', label: 'Status', badge: (v) => v
      ? { text: 'Read', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' }
      : { text: 'Unread', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' }
    },
    { key: 'created_at', label: 'Sent', format: (v) => v ? new Date(v).toLocaleString() : '-' },
  ];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadMessages();
  }

  loadMessages(): void {
    this.loading.set(true);
    this.adminService.getMessages({
      page: this.currentPage(),
      search: this.searchQuery() || undefined,
    }).subscribe({
      next: (res: any) => {
        this.messages.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load messages');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadMessages();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadMessages();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadMessages();
    }
  }
}
