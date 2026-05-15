import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Address {
  id: number;
  user_id: number;
  label: string;
  address_line: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressRequest {
  label?: string;
  address_line: string;
  is_default?: boolean;
}

export interface UpdateAddressRequest {
  label?: string;
  address_line?: string;
  is_default?: boolean;
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
  getAddressesByUserUuid(userUuid: string): Observable<{ data: Address[]; statusCode: number; message: string }> {
    return this.api.get<{ data: Address[]; statusCode: number; message: string }>(`addresses/user/${userUuid}`, {});
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
