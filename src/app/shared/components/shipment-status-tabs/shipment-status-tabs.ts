import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

export interface ShipmentStatusTab {
  id: string;
  label: string;
  icon?: string;
  count?: number;
}

@Component({
  selector: 'app-shipment-status-tabs',
  imports: [CommonModule],
  host: { class: 'block min-w-0 max-w-full' },
  template: `
    <div class="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm mb-6 min-w-0 max-w-full overflow-hidden">
      <nav class="flex w-full max-w-full overflow-x-auto no-scrollbar" [attr.aria-label]="ariaLabel()">
        @for (tab of tabs(); track tab.id) {
          <button type="button" (click)="tabChange.emit(tab.id)" [attr.aria-pressed]="activeTab() === tab.id"
                  class="flex-none min-w-max px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors duration-200 flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500"
                  [ngClass]="activeTab() === tab.id ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333]'">
            <i class="fa-solid" [ngClass]="tab.icon || icons[tab.id] || 'fa-box'" aria-hidden="true"></i>
            <span>{{ tab.label }}</span>
            @if (tab.count !== undefined) {
              <span class="rounded-full px-2 py-0.5 text-xs bg-gray-100 dark:bg-[#333]">{{ tab.count }}</span>
            }
          </button>
        }
      </nav>
    </div>
  `,
})
export class ShipmentStatusTabs {
  readonly tabs = input.required<readonly ShipmentStatusTab[]>();
  readonly activeTab = input('all');
  readonly ariaLabel = input('Filter shipments by status');
  readonly tabChange = output<string>();
  readonly icons: Record<string, string> = {
    pending_confirmation: 'fa-clock', confirmed: 'fa-check-circle', partially_received: 'fa-triangle-exclamation',
    at_warehouse: 'fa-warehouse', half_loaded: 'fa-box-open', loading_container: 'fa-dolly', loaded_in_container: 'fa-box',
    at_port_abroad: 'fa-anchor', in_transit: 'fa-truck', at_tanzania_port: 'fa-ship', at_tanzania_warehouse: 'fa-warehouse',
    delivered: 'fa-check-double', cancelled: 'fa-times-circle',
  };
}
