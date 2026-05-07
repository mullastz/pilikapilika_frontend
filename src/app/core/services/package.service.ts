import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface PackageRequest {
  name: string;
  description?: string;
  package_type?: string;
  total_weight?: number;
  total_volume?: number;
  total_value?: number;
  currency?: string;
  pickup_address?: string;
  destination_address?: string;
  tracking_number?: string;
  products: Array<{
    uuid: string;
    quantity: number;
  }>;
  photos?: File[];
  removed_photos?: string[];
}

export interface PackageResponse {
  message: string;
  data: {
    package: Package;
    qr_code: {
      uuid: string;
      qr_data: string;
    };
  };
}

export interface Package {
  uuid: string;
  name: string;
  description?: string;
  package_type?: string;
  total_weight?: number;
  total_volume?: number;
  total_value?: number;
  currency: string;
  pickup_address?: string;
  destination_address?: string;
  tracking_number?: string;
  products: Array<{
    uuid: string;
    quantity: number;
  }>;
  photos: string[] | null;
  qr_data?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class PackageService {
  constructor(private api: ApiService) {}

  store(formData: FormData): Observable<PackageResponse> {
    return this.api.post<PackageResponse>('packages', formData);
  }

  getAll(): Observable<{ data: Package[] }> {
    return this.api.get<{ data: Package[] }>('packages');
  }

  getByUuid(uuid: string): Observable<any> {
    return this.api.get(`packages/${uuid}`);
  }

  update(uuid: string, formData: FormData): Observable<PackageResponse> {
    // Laravel supports POST with _method=PUT for file uploads
    formData.append('_method', 'PUT');
    return this.api.post<PackageResponse>(`packages/${uuid}`, formData);
  }

  delete(uuid: string): Observable<any> {
    return this.api.delete(`packages/${uuid}`);
  }
}
