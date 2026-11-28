import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Country {
  id: number;
  name: string;
  iso2: string;
  /** 1 for common source countries listed first in pickers. */
  priority?: number;
}

export interface Address {
  id: number;
  user_id: number;
  label: string;
  address_line: string;
  address_type?: 'local' | 'abroad' | null;
  /** Local addresses are always Tanzania; abroad addresses must name their country. */
  country_id?: number | null;
  country?: Pick<Country, 'id' | 'name' | 'iso2'> | null;
  transport_method: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressRequest {
  label?: string;
  address_line: string;
  address_type?: 'local' | 'abroad' | null;
  country_id?: number | null;
  transport_method?: string | null;
  is_default?: boolean;
}

export interface UpdateAddressRequest {
  label?: string;
  address_line?: string;
  address_type?: 'local' | 'abroad' | null;
  country_id?: number | null;
  transport_method?: string | null;
  is_default?: boolean;
}

/** Flag emoji for an ISO 3166-1 alpha-2 code, e.g. "CN" → 🇨🇳. */
export function countryFlag(iso2: string | null | undefined): string {
  if (!iso2 || !/^[A-Za-z]{2}$/.test(iso2)) return '';
  return String.fromCodePoint(...[...iso2.toUpperCase()].map(char => 0x1f1e6 + char.charCodeAt(0) - 65));
}

/** Abroad addresses saved before countries existed that still need one. */
export function abroadAddressesMissingCountry(addresses: Address[]): Address[] {
  return addresses.filter(address => address.address_type === 'abroad' && !address.country_id);
}

/**
 * AddressService - Handles user physical address operations
 * (CRUD operations for multiple addresses)
 */
@Injectable({
  providedIn: 'root'
})
export class AddressService {
  constructor(private api: ApiService) {}

  /**
   * Get all addresses for the authenticated user
   */
  getAddresses(): Observable<{ data: Address[]; statusCode: number; message: string }> {
    return this.api.get<{ data: Address[]; statusCode: number; message: string }>('addresses', {});
  }

  /**
   * Get addresses for a specific user by UUID
   */
  getAddressesByUserUuid(userUuid: string, type?: 'abroad'): Observable<{ data: Address[]; statusCode: number; message: string }> {
    return this.api.get<{ data: Address[]; statusCode: number; message: string }>(`addresses/user/${userUuid}`, type ? { type } : {});
  }

  /** Active countries, common source countries first. `origin` excludes Tanzania (for abroad addresses). */
  getCountries(scope?: 'origin'): Observable<{ data: Country[] }> {
    return this.api.get<{ data: Country[] }>('countries', scope ? { scope } : {});
  }

  // Create a new address
  createAddress(data: CreateAddressRequest): Observable<{ data: Address; statusCode: number; message: string }> {
    return this.api.post<{ data: Address; statusCode: number; message: string }>('addresses', data);
  }

  // Update an existing address
  updateAddress(id: number, data: UpdateAddressRequest): Observable<{ data: Address; statusCode: number; message: string }> {
    return this.api.put<{ data: Address; statusCode: number; message: string }>(`addresses/${id}`, data);
  }

  // Delete an address
  deleteAddress(id: number): Observable<{ message: string; statusCode: number }> {
    return this.api.delete<{ message: string; statusCode: number }>(`addresses/${id}`);
  }

  // Set an address as default
  setDefaultAddress(id: number): Observable<{ data: Address; statusCode: number; message: string }> {
    return this.api.post<{ data: Address; statusCode: number; message: string }>(`addresses/${id}/set-default`, {});
  }
}
