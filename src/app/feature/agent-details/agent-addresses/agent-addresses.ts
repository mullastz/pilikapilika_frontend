import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  Address,
  AddressService,
  CreateAddressRequest,
} from '../../../core/services/address.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  TRANSPORT_CATALOG,
  TransportOption,
  transportIcon,
  transportLabel,
} from '../../../core/utils/transport-methods.util';

@Component({
  selector: 'app-agent-addresses',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './agent-addresses.html',
})
export class AgentAddresses implements OnInit {
  @Input() transportMethods: readonly string[] = [];

  private readonly addressService = inject(AddressService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly addressForm = this.fb.group({
    label: ['', Validators.maxLength(50)],
    address_line: ['', [Validators.required, Validators.maxLength(500)]],
    transport_method: ['', Validators.required],
    is_default: [false],
  });
  readonly transportLabel = transportLabel;
  readonly transportIcon = transportIcon;

  addresses: Address[] = [];
  isLoadingAddresses = false;
  isSavingAddress = false;
  editingAddressId: number | null = null;
  showAddressForm = false;
  isTransportDropdownOpen = false;

  get isEditingAddress(): boolean {
    return this.editingAddressId !== null;
  }

  get agentTransportOptions(): TransportOption[] {
    return [...new Set(this.transportMethods)].map(
      (value) =>
        TRANSPORT_CATALOG.find((option) => option.value === value) ?? {
          value,
          label: value,
          icon: 'fa-solid fa-truck-fast',
        },
    );
  }

  get selectedTransportOption(): TransportOption | null {
    return (
      this.agentTransportOptions.find(
        (option) => option.value === this.addressForm.controls.transport_method.value,
      ) ?? null
    );
  }

  get addressLine() {
    return this.addressForm.controls.address_line;
  }

  ngOnInit(): void {
    this.loadAddresses();
  }

  loadAddresses(): void {
    this.isLoadingAddresses = true;
    this.addressService
      .getAddresses()
      .pipe(
        finalize(() => {
          this.isLoadingAddresses = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.addresses = response.data || [];
        },
        error: () => {
          this.toastService.error('Failed to load receiving addresses. Please try again.');
        },
      });
  }

  showAddAddressForm(): void {
    this.editingAddressId = null;
    this.addressForm.reset();
    this.isTransportDropdownOpen = false;
    this.showAddressForm = true;
  }

  editAddress(address: Address): void {
    this.editingAddressId = address.id;
    this.addressForm.reset({
      label: address.label || '',
      address_line: address.address_line,
      transport_method: address.transport_method || '',
      is_default: address.is_default,
    });
    this.isTransportDropdownOpen = false;
    this.showAddressForm = true;
  }

  cancelAddressForm(): void {
    this.showAddressForm = false;
    this.editingAddressId = null;
    this.isTransportDropdownOpen = false;
    this.addressForm.reset();
  }

  toggleTransportDropdown(): void {
    this.isTransportDropdownOpen = !this.isTransportDropdownOpen;
  }

  selectTransportMethod(value: string): void {
    this.addressForm.controls.transport_method.setValue(value);
    this.isTransportDropdownOpen = false;
  }

  saveAddress(): void {
    if (this.isSavingAddress) return;
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }
    if (!this.selectedTransportOption) {
      this.addressForm.controls.transport_method.setErrors({ unavailableTransport: true });
      this.addressForm.controls.transport_method.markAsTouched();
      this.toastService.error('Select a transport method saved in your Agent Profile.');
      return;
    }

    const value = this.addressForm.getRawValue();
    const data: CreateAddressRequest = {
      label: value.label.trim() || undefined,
      address_line: value.address_line.trim(),
      transport_method: value.transport_method,
      is_default: value.is_default,
    };
    if (!data.address_line) {
      this.addressLine.setErrors({ required: true });
      this.addressLine.markAsTouched();
      return;
    }
    const editing = this.isEditingAddress;
    const request =
      this.editingAddressId !== null
        ? this.addressService.updateAddress(this.editingAddressId, data)
        : this.addressService.createAddress(data);
    this.isSavingAddress = true;
    request
      .pipe(
        finalize(() => {
          this.isSavingAddress = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.toastService.success(
            editing
              ? 'Receiving address updated successfully!'
              : 'Receiving address added successfully!',
          );
          this.cancelAddressForm();
          this.loadAddresses();
        },
        error: (error) => {
          this.toastService.error(
            error.error?.message || 'Failed to save receiving address. Please try again.',
          );
        },
      });
  }

  deleteAddress(id: number): void {
    if (!confirm('Are you sure you want to delete this receiving address?')) return;
    this.addressService.deleteAddress(id).subscribe({
      next: () => {
        this.toastService.success('Receiving address deleted successfully!');
        this.loadAddresses();
      },
      error: (error) => {
        this.toastService.error(
          error.error?.message || 'Failed to delete receiving address. Please try again.',
        );
      },
    });
  }

  setDefaultAddress(id: number): void {
    this.addressService.setDefaultAddress(id).subscribe({
      next: () => {
        this.toastService.success('Default receiving address updated successfully!');
        this.loadAddresses();
      },
      error: (error) => {
        this.toastService.error(
          error.error?.message || 'Failed to set default receiving address. Please try again.',
        );
      },
    });
  }
}
