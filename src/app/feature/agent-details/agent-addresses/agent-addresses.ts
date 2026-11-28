import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, retry } from 'rxjs';
import {
  Address,
  AddressService,
  Country,
  CreateAddressRequest,
  abroadAddressesMissingCountry,
  countryFlag,
} from '../../../core/services/address.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  TRANSPORT_CATALOG,
  TransportOption,
  transportIcon,
  transportLabel,
} from '../../../core/utils/transport-methods.util';

/** Lower-case and strip accents so "cote" finds "Côte d'Ivoire". */
function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

@Component({
  selector: 'app-agent-addresses',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './agent-addresses.html',
})
export class AgentAddresses implements OnInit {
  @Input() transportMethods: readonly string[] = [];

  @Output() addressesChanged = new EventEmitter<Address[]>();

  @ViewChild('addressEditor') private addressEditor?: ElementRef<HTMLDivElement>;
  @ViewChild('addressLabel') private addressLabel?: ElementRef<HTMLInputElement>;

  private readonly addressService = inject(AddressService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly addressForm = this.fb.group({
    label: ['', Validators.maxLength(50)],
    address_type: ['local', Validators.required],
    // Required for abroad addresses (chosen first); local addresses are always Tanzania.
    country_id: new FormControl<number | null>(null),
    address_line: ['', [Validators.required, Validators.maxLength(500)]],
    transport_method: ['', Validators.required],
    is_default: [false],
  });
  readonly transportLabel = transportLabel;
  readonly transportIcon = transportIcon;
  readonly countryFlag = countryFlag;

  // ── Countries (abroad addresses) ─────────────────────────────────
  countries: Country[] = [];
  countriesError = false;
  get commonCountries(): Country[] { return this.countries.filter(country => (country.priority ?? 0) > 0); }
  get otherCountries(): Country[] { return this.countries.filter(country => !(country.priority ?? 0)); }
  get isAbroadForm(): boolean { return this.addressForm.controls.address_type.value === 'abroad'; }
  get countryControl() { return this.addressForm.controls.country_id; }

  /** Abroad addresses saved before countries were introduced. */
  get addressesMissingCountry(): Address[] { return abroadAddressesMissingCountry(this.addresses); }

  /** Abroad addresses grouped by country (addresses still needing a country first). */
  get abroadGroups(): { country: Address['country']; addresses: Address[] }[] {
    const groups = new Map<string, { country: Address['country']; addresses: Address[] }>();
    for (const address of this.addressesFor('abroad')) {
      const key = address.country ? String(address.country.id) : 'missing';
      if (!groups.has(key)) groups.set(key, { country: address.country ?? null, addresses: [] });
      groups.get(key)!.addresses.push(address);
    }
    return [...groups.values()].sort((a, b) =>
      !a.country ? -1 : !b.country ? 1 : a.country.name.localeCompare(b.country.name));
  }

  loadCountries(): void {
    this.countriesError = false;
    this.addressService.getCountries('origin').pipe(retry({ count: 2, delay: 800 })).subscribe({
      next: response => { this.countries = response.data || []; this.cdr.markForCheck(); },
      error: () => { this.countriesError = true; this.cdr.markForCheck(); },
    });
  }

  // ── Searchable country picker ────────────────────────────────────
  countryQuery = '';
  isCountryListOpen = false;
  activeCountryIndex = 0;

  get selectedCountry(): Country | null {
    return this.countries.find(country => country.id === this.countryControl.value) ?? null;
  }

  /**
   * Countries matching the search (name ignoring accents, or ISO code), names starting with the
   * search first. With no search: common source countries, then all others.
   */
  get countryOptions(): { country: Country; heading: string | null }[] {
    const query = normalizeSearch(this.countryQuery);
    if (!query) {
      return [
        ...this.commonCountries.map((country, i) => ({ country, heading: i === 0 ? 'Common source countries' : null })),
        ...this.otherCountries.map((country, i) => ({ country, heading: i === 0 ? 'All countries' : null })),
      ];
    }
    return this.countries
      .map(country => ({ country, name: normalizeSearch(country.name) }))
      .filter(({ country, name }) => name.includes(query) || country.iso2.toLowerCase() === query)
      .sort((a, b) => Number(!a.name.startsWith(query)) - Number(!b.name.startsWith(query)) || a.name.localeCompare(b.name))
      .map(({ country }) => ({ country, heading: null }));
  }

  openCountryList(): void {
    this.isCountryListOpen = true;
    this.activeCountryIndex = 0;
  }

  onCountryQueryChange(value: string): void {
    this.countryQuery = value;
    this.isCountryListOpen = true;
    this.activeCountryIndex = 0;
  }

  /** Delay so a click on an option registers before the list closes. */
  onCountryBlur(): void {
    setTimeout(() => {
      this.isCountryListOpen = false;
      this.countryQuery = '';
      this.countryControl.markAsTouched();
      this.cdr.markForCheck();
    }, 150);
  }

  chooseCountry(country: Country): void {
    this.countryControl.setValue(country.id);
    this.countryControl.markAsTouched();
    this.countryQuery = '';
    this.isCountryListOpen = false;
  }

  /** Clears the country and puts the cursor in the search box (which opens the list). */
  clearCountry(): void {
    this.countryControl.setValue(null);
    this.countryQuery = '';
    const input = document.getElementById('agent-address-country') as HTMLInputElement | null;
    if (input) input.focus(); else this.openCountryList();
  }

  onCountryKeydown(event: KeyboardEvent): void {
    const options = this.countryOptions;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.isCountryListOpen) { this.openCountryList(); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeCountryIndex = Math.min(Math.max(this.activeCountryIndex + step, 0), Math.max(options.length - 1, 0));
      document.getElementById(`agent-country-option-${this.activeCountryIndex}`)?.scrollIntoView?.({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[this.activeCountryIndex];
      if (this.isCountryListOpen && option) this.chooseCountry(option.country);
    } else if (event.key === 'Escape') {
      this.isCountryListOpen = false;
      this.countryQuery = '';
    }
  }

  private resetCountryPicker(): void {
    this.countryQuery = '';
    this.isCountryListOpen = false;
    this.activeCountryIndex = 0;
  }

  /** Opens the first abroad address that still needs a country. */
  fixNextMissingCountry(): void {
    const next = this.addressesMissingCountry[0];
    if (next) this.editAddress(next);
  }

  selectedCategory: 'local' | 'abroad' = 'local';

  get visibleCategories(): string[] {
    return [this.selectedCategory, ...(this.addressesFor('uncategorized').length ? ['uncategorized'] : [])];
  }

  selectCategory(category: 'local' | 'abroad'): void {
    if (this.isSavingAddress) return;
    this.selectedCategory = category;
    if (this.showAddressForm) this.addressForm.controls.address_type.setValue(category);
  }

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
    this.loadCountries();
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
          this.addressesChanged.emit(this.addresses);
        },
        error: () => {
          this.toastService.error('Failed to load receiving addresses. Please try again.');
        },
      });
  }

  addressesFor(type: string): Address[] {
    return this.addresses.filter(address => type === 'uncategorized' ? !address.address_type : address.address_type === type);
  }

  showAddAddressForm(type: 'local' | 'abroad' = this.selectedCategory): void {
    this.selectedCategory = type;
    this.editingAddressId = null;
    this.addressForm.reset({ address_type: type, country_id: null });
    this.resetCountryPicker();
    this.isTransportDropdownOpen = false;
    this.showAddressForm = true;
    this.focusAddressForm();
  }

  editAddress(address: Address): void {
    this.selectedCategory = address.address_type || this.selectedCategory;
    this.editingAddressId = address.id;
    this.addressForm.reset({
      label: address.label || '',
      address_type: address.address_type || 'local',
      country_id: address.address_type === 'abroad' ? address.country_id ?? null : null,
      address_line: address.address_line,
      transport_method: address.transport_method || '',
      is_default: address.is_default,
    });
    this.resetCountryPicker();
    this.isTransportDropdownOpen = false;
    this.showAddressForm = true;
    this.focusAddressForm();
  }

  private focusAddressForm(): void {
    this.cdr.detectChanges();
    this.addressEditor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.addressLabel?.nativeElement.focus({ preventScroll: true });
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
    if (this.isAbroadForm && !this.countryControl.value) {
      this.countryControl.setErrors({ required: true });
    }
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }
    if (!this.selectedTransportOption) {
      this.addressForm.controls.transport_method.setErrors({ unavailableTransport: true });
      this.addressForm.controls.transport_method.markAsTouched();
      this.toastService.error('Select one of your Agent Profile transport methods.');
      return;
    }

    const value = this.addressForm.getRawValue();
    const data: CreateAddressRequest = {
      label: value.label.trim() || undefined,
      address_line: value.address_line.trim(),
      address_type: value.address_type as 'local' | 'abroad',
      // The API sets Tanzania for local addresses.
      country_id: value.address_type === 'abroad' ? value.country_id : null,
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
          this.selectedCategory = data.address_type === 'abroad' ? 'abroad' : 'local';
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
