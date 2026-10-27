import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { Address, AddressService } from '../../../core/services/address.service';
import { ToastService } from '../../../core/services/toast.service';
import { AgentAddresses } from './agent-addresses';

const warehouse: Address = {
  id: 7,
  user_id: 4,
  label: 'Guangzhou Warehouse',
  address_line: 'Warehouse 12, Guangzhou',
  transport_method: 'sea',
  is_default: true,
  created_at: '2026-10-27T12:00:00Z',
  updated_at: '2026-10-27T12:00:00Z',
};

describe('Agent receiving addresses', () => {
  let fixture: ComponentFixture<AgentAddresses>;
  let component: AgentAddresses;
  let addresses: Record<
    'getAddresses' | 'createAddress' | 'updateAddress' | 'deleteAddress' | 'setDefaultAddress',
    ReturnType<typeof vi.fn>
  >;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    addresses = {
      getAddresses: vi.fn(() => of({ data: [warehouse], statusCode: 200, message: 'Loaded' })),
      createAddress: vi.fn(() => of({ data: warehouse, statusCode: 201, message: 'Created' })),
      updateAddress: vi.fn(() => of({ data: warehouse, statusCode: 200, message: 'Updated' })),
      deleteAddress: vi.fn(() => of({ statusCode: 200, message: 'Deleted' })),
      setDefaultAddress: vi.fn(() => of({ data: warehouse, statusCode: 200, message: 'Updated' })),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AgentAddresses],
      providers: [
        { provide: AddressService, useValue: addresses },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AgentAddresses);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('transportMethods', ['sea', 'air']);
    fixture.detectChanges();
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads existing warehouses with their transport and default status', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Warehouses & Receiving Addresses');
    expect(text).toContain(warehouse.label);
    expect(text).toContain(warehouse.address_line);
    expect(text).toContain('Sea Freight');
    expect(text).toContain('Default');
    expect(addresses.getAddresses).toHaveBeenCalledTimes(1);
  });

  it('submits a new receiving address with its transport and default selection', async () => {
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    component.addressForm.setValue({
      label: ' Air receiving point ',
      address_line: ' Warehouse 20 ',
      transport_method: 'air',
      is_default: true,
    });
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(addresses.createAddress).toHaveBeenCalledWith({
      label: 'Air receiving point',
      address_line: 'Warehouse 20',
      transport_method: 'air',
      is_default: true,
    });
    expect(addresses.getAddresses).toHaveBeenCalledTimes(2);
    expect(component.showAddressForm).toBe(false);
    expect(component.isSavingAddress).toBe(false);
  });

  it('edits the original record instead of creating a replacement', () => {
    component.editAddress(warehouse);
    component.addressForm.patchValue({ address_line: 'Updated receiving address' });
    component.saveAddress();
    expect(addresses.updateAddress).toHaveBeenCalledWith(warehouse.id, {
      label: warehouse.label,
      address_line: 'Updated receiving address',
      transport_method: 'sea',
      is_default: true,
    });
    expect(addresses.createAddress).not.toHaveBeenCalled();
  });

  it('requires an address and transport without getting stuck in the saving state', () => {
    component.showAddAddressForm();
    component.addressForm.patchValue({ address_line: 'Warehouse 20' });
    component.saveAddress();
    expect(component.addressForm.controls.transport_method.touched).toBe(true);
    expect(component.isSavingAddress).toBe(false);
    expect(addresses.createAddress).not.toHaveBeenCalled();
    component.addressForm.patchValue({ address_line: '   ', transport_method: 'air' });
    component.saveAddress();
    expect(component.addressLine.hasError('required')).toBe(true);
    expect(addresses.createAddress).not.toHaveBeenCalled();
  });

  it('uses updated saved transport methods and rejects a method removed from the profile', () => {
    component.editAddress(warehouse);
    fixture.componentRef.setInput('transportMethods', ['air']);
    fixture.detectChanges();
    expect(component.agentTransportOptions.map((option) => option.value)).toEqual(['air']);
    component.saveAddress();
    expect(addresses.updateAddress).not.toHaveBeenCalled();
    expect(component.isSavingAddress).toBe(false);
    component.selectTransportMethod('air');
    component.saveAddress();
    expect(addresses.updateAddress).toHaveBeenCalledWith(
      warehouse.id,
      expect.objectContaining({ transport_method: 'air' }),
    );
  });

  it('retains the form and clears saving state after an API failure', () => {
    addresses.updateAddress.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to save address' } })),
    );
    component.editAddress(warehouse);
    component.saveAddress();
    expect(component.showAddressForm).toBe(true);
    expect(component.isSavingAddress).toBe(false);
    expect(component.addressLine.value).toBe(warehouse.address_line);
    expect(toast.error).toHaveBeenCalledWith('Unable to save address');
  });

  it('prevents duplicate submissions while a save is pending', () => {
    const pending = new Subject<{ data: Address; statusCode: number; message: string }>();
    addresses.updateAddress.mockReturnValue(pending);
    component.editAddress(warehouse);
    component.saveAddress();
    component.saveAddress();
    expect(component.isSavingAddress).toBe(true);
    expect(addresses.updateAddress).toHaveBeenCalledTimes(1);
    pending.next({ data: warehouse, statusCode: 200, message: 'Updated' });
    pending.complete();
    expect(component.isSavingAddress).toBe(false);
  });

  it('sets the default address and reloads the stored records', () => {
    component.setDefaultAddress(warehouse.id);
    expect(addresses.setDefaultAddress).toHaveBeenCalledWith(warehouse.id);
    expect(addresses.getAddresses).toHaveBeenCalledTimes(2);
  });

  it('requires confirmation before deleting an address', () => {
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.deleteAddress(warehouse.id);
    expect(addresses.deleteAddress).not.toHaveBeenCalled();
    confirmation.mockReturnValue(true);
    component.deleteAddress(warehouse.id);
    expect(addresses.deleteAddress).toHaveBeenCalledWith(warehouse.id);
    expect(addresses.getAddresses).toHaveBeenCalledTimes(2);
  });
});
