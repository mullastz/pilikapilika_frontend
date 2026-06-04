/**
 * Shipment Progress Helper
 *
 * Pure TypeScript utilities for calculating shipment progress,
 * stage labels, colors, and stage completion logic.
 *
 * No Angular dependencies.
 */

/** All shipment statuses in their logical progression order (excluding cancelled). */
export const SHIPMENT_STATUS_ORDER: readonly string[] = [
  'pending_confirmation',
  'confirmed',
  'partially_received',
  'at_warehouse',
  'half_loaded',
  'loading_container',
  'loaded_in_container',
  'at_port_abroad',
  'in_transit',
  'at_tanzania_port',
  'at_tanzania_warehouse',
  'delivered',
] as const;

/** Mapping of each status to its completion percentage. */
export const SHIPMENT_PROGRESS_WEIGHTS: Record<string, number> = {
  pending_confirmation: 5,
  confirmed: 15,
  partially_received: 20,
  at_warehouse: 25,
  half_loaded: 30,
  loading_container: 35,
  loaded_in_container: 50,
  at_port_abroad: 58,
  in_transit: 65,
  at_tanzania_port: 75,
  at_tanzania_warehouse: 85,
  delivered: 100,
  cancelled: 0,
};

/** Stage metadata for display. */
const STAGE_META: Record<string, { label: string; icon: string }> = {
  pending_confirmation: { label: 'Pending', icon: 'fa-clock' },
  confirmed: { label: 'Confirmed', icon: 'fa-check' },
  partially_received: { label: 'Partially Received', icon: 'fa-triangle-exclamation' },
  at_warehouse: { label: 'At Warehouse', icon: 'fa-warehouse' },
  half_loaded: { label: 'Half Loaded', icon: 'fa-box-open' },
  loading_container: { label: 'Loading', icon: 'fa-dolly' },
  loaded_in_container: { label: 'Loaded', icon: 'fa-box-open' },
  at_port_abroad: { label: 'At Port Abroad', icon: 'fa-anchor' },
  in_transit: { label: 'In Transit', icon: 'fa-ship' },
  at_tanzania_port: { label: 'At Port', icon: 'fa-anchor' },
  at_tanzania_warehouse: { label: 'Local Warehouse', icon: 'fa-store' },
  delivered: { label: 'Delivered', icon: 'fa-handshake' },
};

/** Progress stage object used by the UI. */
export interface ProgressStage {
  key: string;
  label: string;
  icon: string;
  completed: boolean;
  current: boolean;
  date?: string | null;
}

/**
 * Returns the completion percentage for a given shipment status.
 */
export function getShipmentProgress(status: string): number {
  return SHIPMENT_PROGRESS_WEIGHTS[status] ?? 0;
}

/**
 * Returns the index of a status in the logical progression order.
 */
export function getShipmentStageIndex(status: string): number {
  return SHIPMENT_STATUS_ORDER.indexOf(status);
}

/**
 * Returns a user-friendly label for a shipment status.
 */
export function getShipmentStageLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_confirmation: 'Pending Confirmation',
    confirmed: 'Confirmed',
    partially_received: 'Partially Received',
    at_warehouse: 'At Warehouse',
    half_loaded: 'Half Loaded',
    loading_container: 'Loading Container',
    loaded_in_container: 'Loaded in Container',
    at_port_abroad: 'At Port Abroad',
    in_transit: 'In Transit',
    at_tanzania_port: 'At Tanzania Port',
    at_tanzania_warehouse: 'At Tanzania Warehouse',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };

  return labels[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns a Tailwind color class for the progress bar fill based on status.
 */
export function getShipmentProgressColor(status: string): string {
  const colors: Record<string, string> = {
    pending_confirmation: 'bg-yellow-500',
    confirmed: 'bg-purple-500',
    partially_received: 'bg-yellow-500',
    at_warehouse: 'bg-indigo-500',
    half_loaded: 'bg-amber-500',
    loading_container: 'bg-orange-500',
    loaded_in_container: 'bg-teal-500',
    at_port_abroad: 'bg-amber-500',
    in_transit: 'bg-blue-500',
    at_tanzania_port: 'bg-cyan-500',
    at_tanzania_warehouse: 'bg-sky-500',
    delivered: 'bg-green-500',
    cancelled: 'bg-red-500',
  };

  return colors[status] ?? 'bg-gray-500';
}

/**
 * Checks if a given stage is completed relative to the shipment's current status.
 */
export function isStageCompleted(shipmentStatus: string, stageStatus: string): boolean {
  const shipmentIndex = getShipmentStageIndex(shipmentStatus);
  const stageIndex = getShipmentStageIndex(stageStatus);

  if (shipmentIndex === -1 || stageIndex === -1) {
    return false;
  }

  return stageIndex < shipmentIndex;
}

/**
 * Checks if a given stage is the current active stage.
 */
export function isStageCurrent(shipmentStatus: string, stageStatus: string): boolean {
  return shipmentStatus === stageStatus;
}

/**
 * Returns the full list of stages with their completion and current-state flags.
 * Optionally accepts a map of stage keys to dates for display.
 */
export function getProgressStages(
  status: string,
  dates?: Record<string, string | null>
): ProgressStage[] {
  if (status === 'cancelled') {
    return SHIPMENT_STATUS_ORDER.map((key) => ({
      key,
      label: STAGE_META[key]?.label ?? getShipmentStageLabel(key),
      icon: STAGE_META[key]?.icon ?? 'fa-circle',
      completed: false,
      current: false,
      date: dates?.[key] ?? null,
    }));
  }

  const currentIndex = getShipmentStageIndex(status);

  return SHIPMENT_STATUS_ORDER.map((key, index) => ({
    key,
    label: STAGE_META[key]?.label ?? getShipmentStageLabel(key),
    icon: STAGE_META[key]?.icon ?? 'fa-circle',
    completed: index <= currentIndex,
    current: index === currentIndex,
    date: dates?.[key] ?? null,
  }));
}

/**
 * Formats a raw status string into a human-readable title-case string.
 */
export function formatShipmentStatus(status: string): string {
  if (!status) return 'Unknown';
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Returns Tailwind badge classes for a given shipment status.
 */
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'delivered':
      return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400';
    case 'cancelled':
      return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400';
    case 'pending_confirmation':
      return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400';
    case 'in_transit':
      return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400';
    case 'confirmed':
      return 'bg-[#BABF71]/20 dark:bg-[#BABF71]/10 text-[#8B8F4A] dark:text-[#BABF71]';
    default:
      return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400';
  }
}
