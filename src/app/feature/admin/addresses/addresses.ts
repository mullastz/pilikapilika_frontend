import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

interface AddressUser {
  id?: number;
  uuid?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
}

interface AddressItem {
  id: number;
  label: string;
  address_line: string;
  is_default: boolean;
  created_at: string;
  user?: AddressUser;
}

@Component({
  selector: 'app-admin-addresses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './addresses.html',
  styleUrl: './addresses.css'
})
export class AdminAddresses implements OnInit {
  addresses = signal<AddressItem[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(15);
  searchQuery = signal('');
  userFilter = signal('');

  modalMode = signal<'none' | 'edit'>('none');
  selectedAddress = signal<AddressItem | null>(null);
  editLabel = signal('');
  editAddressLine = signal('');

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAddresses();
  }

  loadAddresses(): void {
    this.loading.set(true);
    this.adminService.getAddresses({
      page: this.currentPage(),
      per_page: this.perPage(),
      search: this.searchQuery() || undefined,
      user_id: this.userFilter() ? Number(this.userFilter()) : undefined,
    }).subscribe({
      next: (res: any) => {
        this.addresses.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load addresses');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadAddresses();
  }

  onUserFilterChange(): void {
    this.currentPage.set(1);
    this.loadAddresses();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadAddresses();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadAddresses();
    }
  }

  getUserName(address: AddressItem): string {
    const user = address.user;
    if (!user) return '-';
    const name = `${user.firstname || ''} ${user.lastname || ''}`.trim();
    return name || user.email || '-';
  }

  onEdit(address: AddressItem): void {
    this.selectedAddress.set({ ...address });
    this.editLabel.set(address.label || '');
    this.editAddressLine.set(address.address_line || '');
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set('none');
    this.selectedAddress.set(null);
    this.editLabel.set('');
    this.editAddressLine.set('');
  }

  saveEdit(): void {
    const address = this.selectedAddress();
    if (!address) return;

    const payload = {
      label: this.editLabel(),
      address_line: this.editAddressLine(),
    };

    this.adminService.updateAddress(address.id, payload).subscribe({
      next: () => {
        this.toastService.success('Address updated');
        this.closeModal();
        this.loadAddresses();
      },
      error: (err: any) => this.toastService.error(err?.error?.message || 'Failed to update address')
    });
  }

  onSetDefault(address: AddressItem): void {
    if (!confirm(`Set "${address.label}" as default address for this user?`)) return;
    this.adminService.setDefaultAddress(address.id).subscribe({
      next: () => {
        this.toastService.success('Default address updated');
        this.loadAddresses();
      },
      error: (err: any) => this.toastService.error(err?.error?.message || 'Failed to set default address')
    });
  }

  onDelete(address: AddressItem): void {
    if (!confirm(`Delete address "${address.label}"?`)) return;
    this.adminService.deleteAddress(address.id).subscribe({
      next: () => {
        this.toastService.success('Address deleted');
        this.loadAddresses();
      },
      error: (err: any) => this.toastService.error(err?.error?.message || 'Failed to delete address')
    });
  }
}
