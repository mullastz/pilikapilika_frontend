import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { ApiService } from '../../../core/services/api.service';
import { Region, District } from '../../../core/interfaces/auth.interface';

@Component({
  selector: 'app-admin-regions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './regions.html',
  styleUrl: './regions.css'
})
export class AdminRegions implements OnInit {
  regions = signal<Region[]>([]);
  districts = signal<District[]>([]);
  loading = signal(true);
  activeTab = signal<'regions' | 'districts'>('regions');

  // Region form
  newRegionName = signal('');
  editingRegion = signal<Region | null>(null);

  // District form
  newDistrictName = signal('');
  newDistrictRegionId = signal<number | null>(null);
  editingDistrict = signal<District | null>(null);

  constructor(
    private api: ApiService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadRegions();
    this.loadDistricts();
  }

  loadRegions(): void {
    this.api.get<{ success: boolean; data: Region[] }>('regions').subscribe({
      next: (res) => {
        this.regions.set(res.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load regions');
        this.loading.set(false);
      }
    });
  }

  loadDistricts(): void {
    this.api.get<{ success: boolean; data: District[] }>('districts').subscribe({
      next: (res) => {
        this.districts.set(res.data || []);
      },
      error: () => this.toastService.error('Failed to load districts')
    });
  }

  createRegion(): void {
    const name = this.newRegionName().trim();
    if (!name) return;
    this.api.post<{ success: boolean; message: string }>('admin/regions', { name }).subscribe({
      next: (res) => {
        this.toastService.success(res.message || 'Region created');
        this.newRegionName.set('');
        this.loadRegions();
      },
      error: () => this.toastService.error('Failed to create region')
    });
  }

  updateRegion(): void {
    const region = this.editingRegion();
    if (!region) return;
    this.api.put<{ success: boolean; message: string }>(`admin/regions/${region.id}`, { name: region.name }).subscribe({
      next: (res) => {
        this.toastService.success(res.message || 'Region updated');
        this.editingRegion.set(null);
        this.loadRegions();
      },
      error: () => this.toastService.error('Failed to update region')
    });
  }

  deleteRegion(id: number): void {
    if (!confirm('Delete this region?')) return;
    this.api.delete<{ success: boolean; message: string }>(`admin/regions/${id}`).subscribe({
      next: (res) => {
        this.toastService.success(res.message || 'Region deleted');
        this.loadRegions();
        this.loadDistricts();
      },
      error: () => this.toastService.error('Failed to delete region')
    });
  }

  createDistrict(): void {
    const name = this.newDistrictName().trim();
    const regionId = this.newDistrictRegionId();
    if (!name || !regionId) return;
    this.api.post<{ success: boolean; message: string }>('admin/districts', { name, region_id: regionId }).subscribe({
      next: (res) => {
        this.toastService.success(res.message || 'District created');
        this.newDistrictName.set('');
        this.newDistrictRegionId.set(null);
        this.loadDistricts();
      },
      error: () => this.toastService.error('Failed to create district')
    });
  }

  updateDistrict(): void {
    const district = this.editingDistrict();
    if (!district) return;
    this.api.put<{ success: boolean; message: string }>(`admin/districts/${district.id}`, { name: district.name, region_id: district.region_id }).subscribe({
      next: (res) => {
        this.toastService.success(res.message || 'District updated');
        this.editingDistrict.set(null);
        this.loadDistricts();
      },
      error: () => this.toastService.error('Failed to update district')
    });
  }

  deleteDistrict(id: number): void {
    if (!confirm('Delete this district?')) return;
    this.api.delete<{ success: boolean; message: string }>(`admin/districts/${id}`).subscribe({
      next: (res) => {
        this.toastService.success(res.message || 'District deleted');
        this.loadDistricts();
      },
      error: () => this.toastService.error('Failed to delete district')
    });
  }

  getDistrictsForRegion(regionId: number): District[] {
    return this.districts().filter(d => d.region_id === regionId);
  }
}
