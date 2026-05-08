import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { RouterModule } from '@angular/router';

export interface AppSettings {
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

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.html',
})
export class AdminSettings implements OnInit {
  loading = signal(true);
  saving = signal(false);
  activeTab = signal<'platform' | 'delivery' | 'notifications' | 'security' | 'payments'>('platform');

  settings = signal<AppSettings>({
    platform: { platform_name: '', support_email: '', support_phone: '', currency: 'TZS' },
    delivery: { default_base_price: 5000, price_per_km: 1000, max_delivery_distance: 50 },
    notifications: { enable_email_notifications: true, enable_sms_notifications: false, enable_push_notifications: true, notify_new_user_signup: true, notify_new_order: true },
    security: { maintenance_mode: false, maintenance_message: '', password_min_length: 8 },
    payments: { platform_commission_percent: 5 },
  });

  tabs = [
    { key: 'platform' as const, label: 'Platform Info', icon: 'fa-solid fa-building' },
    { key: 'delivery' as const, label: 'Delivery', icon: 'fa-solid fa-truck' },
    { key: 'notifications' as const, label: 'Notifications', icon: 'fa-solid fa-bell' },
    { key: 'security' as const, label: 'Security', icon: 'fa-solid fa-shield-halved' },
    { key: 'payments' as const, label: 'Payments', icon: 'fa-solid fa-money-bill' },
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
        const data = res.data || {};
        this.settings.set({
          platform: {
            platform_name: data.platform?.platform_name || 'Pilika-Pilika',
            support_email: data.platform?.support_email || 'support@pilika.co.tz',
            support_phone: data.platform?.support_phone || '',
            currency: data.platform?.currency || 'TZS',
          },
          delivery: {
            default_base_price: data.delivery?.default_base_price || 5000,
            price_per_km: data.delivery?.price_per_km || 1000,
            max_delivery_distance: data.delivery?.max_delivery_distance || 50,
          },
          notifications: {
            enable_email_notifications: data.notifications?.enable_email_notifications ?? true,
            enable_sms_notifications: data.notifications?.enable_sms_notifications ?? false,
            enable_push_notifications: data.notifications?.enable_push_notifications ?? true,
            notify_new_user_signup: data.notifications?.notify_new_user_signup ?? true,
            notify_new_order: data.notifications?.notify_new_order ?? true,
          },
          security: {
            maintenance_mode: data.security?.maintenance_mode ?? false,
            maintenance_message: data.security?.maintenance_message || '',
            password_min_length: data.security?.password_min_length || 8,
          },
          payments: {
            platform_commission_percent: data.payments?.platform_commission_percent || 5,
          },
        });
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
    const payload = { settings: this.settings() };
    this.adminService.updateSettings(payload).subscribe({
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
      const currentGroup = s[group as keyof AppSettings];
      if (currentGroup && typeof currentGroup === 'object') {
        const updatedGroup = { ...currentGroup as any };
        updatedGroup[key] = !updatedGroup[key];
        return { ...s, [group]: updatedGroup };
      }
      return s;
    });
  }

  getBooleanValue(group: string, key: string): boolean {
    const currentGroup = this.settings()[group as keyof AppSettings];
    if (currentGroup && typeof currentGroup === 'object') {
      return (currentGroup as any)[key] || false;
    }
    return false;
  }
}
