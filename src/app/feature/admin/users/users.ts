import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTable, TableColumn } from '../../../shared/data-table/data-table';
import { AdminService, PaginatedResponse } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { User } from '../../../core/interfaces/auth.interface';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class AdminUsers implements OnInit {
  users = signal<User[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(15);
  searchQuery = signal('');
  roleFilter = signal('');
  modalMode = signal<'none' | 'view' | 'edit'>('none');
  selectedUser = signal<any | null>(null);

  columns: TableColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'firstname', label: 'Name', format: (v, row) => `${row.firstname || ''} ${row.lastname || ''}`.trim() || row.username },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', badge: (v) => {
      const classes: Record<string, string> = {
        Admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
        Seller: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        Buyer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        Owner: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      };
      return { text: v, class: classes[v] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
    }},
    { key: 'is_email_verified', label: 'Status', badge: (v) => v
      ? { text: 'Verified', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }
      : { text: 'Unverified', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' }
    },
    { key: 'created_at', label: 'Joined', format: (v) => v ? new Date(v).toLocaleDateString() : '-' },
  ];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.adminService.getUsers({
      page: this.currentPage(),
      per_page: this.perPage(),
      search: this.searchQuery() || undefined,
      role: this.roleFilter() || undefined,
    }).subscribe({
      next: (res: any) => {
        this.users.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load users');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadUsers();
  }

  onRoleChange(): void {
    this.currentPage.set(1);
    this.loadUsers();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadUsers();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadUsers();
    }
  }

  onView(user: User): void {
    this.selectedUser.set({ ...user });
    this.modalMode.set('view');
  }

  onEdit(user: User): void {
    this.selectedUser.set({ ...user });
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set('none');
    this.selectedUser.set(null);
  }

  saveUserEdit(): void {
    const user = this.selectedUser();
    if (!user) return;
    const payload = {
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      phone: user.phone,
      role: user.role,
      region: user.region,
      district: user.district,
    };
    this.adminService.updateUser(user.id, payload).subscribe({
      next: () => {
        this.toastService.success('User updated');
        this.closeModal();
        this.loadUsers();
      },
      error: () => this.toastService.error('Failed to update user')
    });
  }

  onDelete(user: User): void {
    if (!confirm(`Delete user ${user.firstname || user.username}?`)) return;
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.toastService.success('User deleted');
        this.loadUsers();
      },
      error: () => this.toastService.error('Failed to delete user')
    });
  }
}
