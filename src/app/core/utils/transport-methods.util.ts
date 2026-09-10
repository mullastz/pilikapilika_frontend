export interface TransportOption {
  value: string;
  label: string;
  icon: string;
}

export const TRANSPORT_CATALOG: TransportOption[] = [
  { value: 'air', label: 'Air Freight', icon: 'fa-solid fa-plane' },
  { value: 'sea', label: 'Sea Freight', icon: 'fa-solid fa-ship' },
  { value: 'motorcycle', label: 'Motorcycle', icon: 'fa-solid fa-motorcycle' },
  { value: 'bicycle', label: 'Bicycle', icon: 'fa-solid fa-bicycle' },
  { value: 'car', label: 'Car', icon: 'fa-solid fa-car' },
  { value: 'van', label: 'Van', icon: 'fa-solid fa-van-shuttle' },
  { value: 'truck', label: 'Truck', icon: 'fa-solid fa-truck' },
  { value: 'local', label: 'Local Delivery', icon: 'fa-solid fa-person-walking' },
];

export function transportLabel(value: string | null | undefined): string {
  if (!value) return '';
  return TRANSPORT_CATALOG.find(o => o.value === value)?.label || value;
}

export function transportIcon(value: string | null | undefined): string {
  if (!value) return 'fa-solid fa-truck-fast';
  return TRANSPORT_CATALOG.find(o => o.value === value)?.icon || 'fa-solid fa-truck-fast';
}
