import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Agent } from '../../core/interfaces/auth.interface';
import { AddressService } from '../../core/services/address.service';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UserService } from '../../core/services/user.service';
import { AgentAddresses } from './agent-addresses/agent-addresses';
import { AgentDetails } from './agent-details';

const agent: Agent = {
  id: 4,
  uuid: 'agent-uuid',
  role: 'Seller',
  firstname: 'Agent',
  lastname: 'Example',
  base_price: 100,
  currency: 'TZS',
  transport_methods: ['sea'],
  specializations: [],
  availability_status: 'available',
  total_deliveries: 0,
  rating: 0,
  total_reviews: 0,
  is_agent_verified: false,
  is_verified: false,
  gender: 'Male',
  username: 'agent-example',
  email: 'agent@example.test',
  phone: '123456789',
  region: 'Arusha',
  district: 'Arusha',
  country: 'Tanzania',
  ward: null,
  address: null,
  profile_photo: null,
  is_email_verified: true,
  is_admin: false,
  is_profile_complete: true,
  email_verified_at: '2026-10-27T12:00:00Z',
  agent_verified_at: null,
  agent_verification_requested_at: null,
  created_at: '2026-10-27T12:00:00Z',
  updated_at: '2026-10-27T12:00:00Z',
  price_per_km: null,
  max_delivery_distance: null,
  avg_delivery_time: null,
  bio: null,
  id_number: null,
  image: null,
  success_rate: 0,
};

describe('Agent profile receiving addresses', () => {
  let fixture: ComponentFixture<AgentDetails>;
  let component: AgentDetails;
  let addressService: Record<'getAddresses' | 'createAddress', ReturnType<typeof vi.fn>>;
  let agentService: Record<'getAgentProfile' | 'updateAgentProfile', ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    addressService = {
      getAddresses: vi.fn(() => of({ data: [], statusCode: 200, message: 'Loaded' })),
      createAddress: vi.fn(),
    };
    agentService = {
      getAgentProfile: vi.fn(() =>
        of({ ...agent, transport_methods: [...agent.transport_methods] }),
      ),
      updateAgentProfile: vi.fn(() =>
        of({ data: { ...agent, transport_methods: ['air'] }, statusCode: 200, message: 'Updated' }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [AgentDetails],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getUser: () => agent, setProfileComplete: vi.fn() } },
        { provide: AgentService, useValue: agentService },
        { provide: AddressService, useValue: addressService },
        {
          provide: UserService,
          useValue: { getProfile: () => of({ data: agent, profile: { is_complete: true } }) },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AgentDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('places address management outside the agent profile form', async () => {
    const addresses = fixture.debugElement.query(By.directive(AgentAddresses));
    expect(addresses).not.toBeNull();
    expect(addresses.nativeElement.closest('form')).toBeNull();
    expect(addressService.getAddresses).toHaveBeenCalledTimes(1);
    addresses.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('form')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('form form')).toBeNull();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(agentService.updateAgentProfile).toHaveBeenCalledTimes(1);
    expect(addressService.createAddress).not.toHaveBeenCalled();
  });

  it('uses saved transport methods until profile changes have been saved', async () => {
    const child = fixture.debugElement.query(By.directive(AgentAddresses))
      .componentInstance as AgentAddresses;
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('label'),
    ) as HTMLLabelElement[];
    for (const method of ['Sea Freight', 'Air Freight']) {
      const checkbox = labels
        .find((label) => label.textContent?.includes(method))
        ?.querySelector('input');
      expect(checkbox).toBeTruthy();
      checkbox!.click();
    }
    await fixture.whenStable();
    expect(child.transportMethods).toEqual(['sea']);
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(child.transportMethods).toEqual(['air']);
  });

  it('hides the current user address manager when viewing another agent', async () => {
    agentService.getAgentProfile.mockReturnValue(of({ ...agent, id: 99 }));
    component.loadAgentProfile();
    await fixture.whenStable();
    expect(fixture.debugElement.query(By.directive(AgentAddresses))).toBeNull();
  });
});
