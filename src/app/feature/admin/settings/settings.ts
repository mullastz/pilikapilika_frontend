import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { RouterModule } from '@angular/router';

interface AppSettings {
  platform: {
    platform_name: string;
    support_email: string;
    support_phone: string;
    currency: string;
  };
  delivery: {
    default_base_price: number;
    price_per_km: number;
    max_delivery_distance: number;
  };
  notifications: {
    enable_email_notifications: boolean;
    enable_sms_notifications: boolean;
    enable_push_notifications: boolean;
    notify_new_user_signup: boolean;
    notify_new_order: boolean;
  };
  security: {
    maintenance_mode: boolean;
    maintenance_message: string;
    password_min_length: number;
  };
  payments: {
    platform_commission_percent: number;
  };
}

interface TabItem {
  key: keyof AppSettings;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.html',
})
export class AdminSettings implements OnInit {
  settings = signal<AppSettings>({
    platform: {
      platform_name: '',
      support_email: '',
      support_phone: '',
      currency: 'TZS',
    },
    delivery: {
      default_base_price: 5000,
      price_per_km: 1000,
      max_delivery_distance: 50,
    },
    notifications: {
      enable_email_notifications: true,
      enable_sms_notifications: false,
      enable_push_notifications: true,
      notify_new_user_signup: true,
      notify_new_order: true,
    },
    security: {
      maintenance_mode: false,
      maintenance_message: '',
      password_min_length: 8,
    },
    payments: {
      platform_commission_percent: 5,
    },
  });

  loading = signal(true);
  saving = signal(false);
  activeTab = signal<keyof AppSettings>('platform');

  tabs: TabItem[] = [
    { key: 'platform', label: 'Platform', icon: 'fa-solid fa-cog' },
    { key: 'delivery', label: 'Delivery', icon: 'fa-solid fa-truck' },
    { key: 'notifications', label: 'Notifications', icon: 'fa-solid fa-bell' },
    { key: 'security', label: 'Security', icon: 'fa-solid fa-shield-halved' },
    { key: 'payments', label: 'Payments', icon: 'fa-solid fa-credit-card' },
  ];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading.set(true);
    this.adminService.getSettings().subscribe({
      next: (res) => {
        this.settings.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load settings');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    this.saving.set(true);
    this.adminService.updateSettings({ settings: this.settings() }).subscribe({
      next: () => {
        this.toastService.success('Settings saved successfully');
        this.saving.set(false);
      },
      error: () => {
        this.toastService.error('Failed to save settings');
        this.saving.set(false);
      },
    });
  }

  toggleBoolean(group: string, key: string): void {
    this.settings.update((s) => {
      const groupData = { ...s[group as keyof AppSettings] };
      (groupData as any)[key] = !(groupData as any)[key];
      return { ...s, [group]: groupData };
    });
  }

  getBooleanValue(group: string, key: string): boolean {
    return (this.settings()[group as keyof AppSettings] as any)[key] || false;
  }
}
