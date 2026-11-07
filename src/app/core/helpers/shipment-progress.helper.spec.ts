import { getShipmentStageLabel, getProgressStages, getShipmentProgressColor, getStatusTextClass, SHIPMENT_STATUS_ORDER } from './shipment-progress.helper';

describe('Shipment progress presentation', () => {
  it('distinguishes overseas and Tanzania warehouses in full and compact labels', () => {
    expect(getShipmentStageLabel('at_warehouse')).toBe('At Warehouse Abroad');
    expect(getShipmentStageLabel('at_tanzania_warehouse')).toBe('At Tanzania Warehouse');
    const stages = getProgressStages('at_warehouse');
    expect(stages.find(stage => stage.key === 'at_warehouse')?.label).toContain('Abroad');
    expect(stages.find(stage => stage.key === 'at_tanzania_warehouse')?.label).toContain('Tanzania');
  });
  it('keeps airport and batch terminology for air freight', () => {
    expect(getShipmentStageLabel('at_port_abroad', 'air')).toBe('At Airport Abroad');
    expect(getShipmentStageLabel('loading_container', 'air')).toBe('Loading Batch');
  });
  it.each([...SHIPMENT_STATUS_ORDER, 'cancelled'])('matches card status text colors to the progress color for %s', status => {
    const color = getShipmentProgressColor(status).replace('bg-', '').replace('-500', '');
    expect(getStatusTextClass(status)).toContain(`text-${color}-700`);
    expect(getStatusTextClass(status)).toContain(`dark:text-${color}-400`);
  });
});
