import { QrGenerator } from './qr-generator';
import { convertToParamMap } from '@angular/router';
import { Subject, of } from 'rxjs';

import type { Location } from '@angular/common';
import type { ChangeDetectorRef } from '@angular/core';
import type { ActivatedRoute, Router } from '@angular/router';
import type { AddressService } from '../../core/services/address.service';
import type { AgentService } from '../../core/services/agent.service';
import type { AgentFollowService } from '../../core/services/agent-follow.service';
import type { AuthService } from '../../core/services/auth.service';
import type { QrCodeService } from '../../core/services/qr-code.service';
import type { UserService } from '../../core/services/user.service';

function createComponent(): QrGenerator {
  return new QrGenerator(
    null as unknown as Location,
    null as unknown as Router,
    null as unknown as QrCodeService,
    null as unknown as AgentService,
    null as unknown as AuthService,
    null as unknown as UserService,
    null as unknown as AddressService,
    null as unknown as ChangeDetectorRef,
    null as unknown as ActivatedRoute,
    null as unknown as AgentFollowService,
  );
}

describe('QrGenerator agent booked from a profile', () => {
  const lockedAgent = { uuid: 'agent-a', firstname: 'Asha', lastname: 'Ali', availability_status: 'available', transport_methods: ['sea'] };
  const otherAgent = { uuid: 'agent-b', firstname: 'Other', lastname: 'Agent', availability_status: 'available', transport_methods: ['sea'] };

  function setup(queryParams: Record<string, string>) {
    const agentAddresses: Record<string, Subject<{ data: unknown[] }>> = {};
    const agentService = {
      getPublicAgentProfile: vi.fn(() => of(lockedAgent)),
      getAvailableAgents: vi.fn(),
    };
    const followService = {
      list: vi.fn(() => of({ data: { agents: [lockedAgent, otherAgent], pagination: { current_page: 1, has_more: false, total: 2 } } })),
    };
    const addressService = {
      getAddresses: vi.fn(),
      getAddressesByUserUuid: vi.fn((uuid: string) => (agentAddresses[uuid] ??= new Subject())),
    };
    const route = { snapshot: { queryParamMap: convertToParamMap(queryParams) } };
    const component = new QrGenerator(
      null as unknown as Location, null as unknown as Router, null as unknown as QrCodeService,
      agentService as unknown as AgentService, null as unknown as AuthService, null as unknown as UserService,
      addressService as unknown as AddressService, { detectChanges: vi.fn() } as unknown as ChangeDetectorRef,
      route as unknown as ActivatedRoute, followService as unknown as AgentFollowService,
    );
    component.ngOnInit();
    return { component, agentService, followService, addressService, agentAddresses };
  }

  it('offers only followed agents and never requests the marketplace agent list', () => {
    const { component, agentService, followService } = setup({});
    expect(followService.list).toHaveBeenCalledWith(1, 100);
    expect(agentService.getAvailableAgents).not.toHaveBeenCalled();
    component.selectedTransportMethod = 'sea';
    expect(component.filteredAgents.map(agent => agent.uuid)).toEqual(['agent-a', 'agent-b']);
  });

  it('fixes the agent from the Book button and never loads other agents', () => {
    const { component, agentService, followService } = setup({ agent: 'agent-a' });
    expect(agentService.getAvailableAgents).not.toHaveBeenCalled();
    expect(followService.list).not.toHaveBeenCalled();
    expect(component.selectedAgent?.uuid).toBe('agent-a');
    expect(component.selectedTransportMethod).toBe('sea');
    component.clearAgent();
    component.selectAgent(otherAgent);
    expect(component.selectedAgent?.uuid).toBe('agent-a');
    expect(component.agents.map(agent => agent.uuid)).toEqual(['agent-a']);
  });

  it('keeps the fixed agent when starting another parcel', () => {
    const { component } = setup({ agent: 'agent-a' });
    component.resetForm();
    expect(component.selectedAgent?.uuid).toBe('agent-a');
  });

  it('loads only the selected agent addresses and ignores a late reply for a previous agent', () => {
    const { component, addressService, agentAddresses } = setup({});
    expect(addressService.getAddresses).not.toHaveBeenCalled();
    component.selectedTransportMethod = 'sea';
    component.selectAgent(lockedAgent);
    component.selectAgent(otherAgent);
    agentAddresses['agent-b'].next({ data: [{ id: 2, address_line: 'B warehouse', transport_method: 'sea' }] });
    agentAddresses['agent-a'].next({ data: [{ id: 1, address_line: 'A warehouse', transport_method: 'sea' }] });
    expect(component.addresses.map(address => address.id)).toEqual([2]);
    expect(component.selectedAddress?.id).toBe(2);
    expect(component.isLoadingAddresses).toBe(false);
  });
});

describe('QrGenerator photo removal', () => {
  it('clears pending removals when starting a new product', () => {
    const component = createComponent();
    component.removedExistingPhotos = ['https://pub-example.r2.dev/qr-code-photos/old.jpg'];
    component.resetForm();
    expect(component.removedExistingPhotos).toEqual([]);
  });

  it('queues existing photos once and ignores local previews when clearing all', () => {
    const component = createComponent();
    const existingUrl = 'https://pub-example.r2.dev/products/existing.jpg';
    component.productPhotos = [
      { file: new File([], 'existing'), preview: existingUrl, isExisting: true },
      { file: new File([], 'duplicate'), preview: existingUrl, isExisting: true },
      { file: new File(['new'], 'new'), preview: 'data:image/png;base64,new' },
      { file: new File(['local'], 'local'), preview: 'blob:http://localhost/photo' },
    ];

    component.clearAllPhotos();
    component.clearAllPhotos();

    expect(component.productPhotos).toEqual([]);
    expect(component.removedExistingPhotos).toEqual([existingUrl]);
  });
});
