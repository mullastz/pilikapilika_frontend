import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface QrCodePayload {
  product_name: string;
  product_cost: string;
  currency: string;
  description?: string;
  category?: string;
  package_type?: string;
  quantity?: number;
  total_weight?: string;
  total_volume?: string;
  product_value?: string;
  product_id?: string;
  supplier_name: string;
  supplier_phone: string;
  supplier_contact_person?: string;
  supplier_pickup_address?: string;
  photos?: File[];
}

export interface QrCodeResponse {
  message: string;
  data: {
    qr_code: {
      uuid: string;
      product_name: string;
      product_cost: string;
      currency: string;
      description: string | null;
      category: string | null;
      package_type: string | null;
      quantity: number | null;
      total_weight: string | null;
      total_volume: string | null;
      product_value: string | null;
      product_id: string | null;
      supplier_name: string;
      supplier_phone: string;
      supplier_contact_person: string | null;
      supplier_pickup_address: string | null;
      photos: string[] | null;
      qr_data: string;
      created_at: string;
      updated_at: string;
    };
    qr_data: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class QrCodeService {
  constructor(private api: ApiService) {}

  store(formData: FormData): Observable<QrCodeResponse> {
    return this.api.post<QrCodeResponse>('qr-codes', formData);
  }

  getAll(): Observable<any> {
    return this.api.get('qr-codes');
  }

  getByUuid(uuid: string): Observable<any> {
    return this.api.get(`qr-codes/${uuid}`);
  }

  update(uuid: string, formData: FormData): Observable<QrCodeResponse> {
    // Laravel supports POST with _method=PUT for file uploads
    formData.append('_method', 'PUT');
    return this.api.post<QrCodeResponse>(`qr-codes/${uuid}`, formData);
  }

  delete(uuid: string): Observable<any> {
    return this.api.delete(`qr-codes/${uuid}`);
  }
}
