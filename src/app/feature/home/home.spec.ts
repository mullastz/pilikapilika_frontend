import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentFollowService } from '../../core/services/agent-follow.service';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { QrCodeService } from '../../core/services/qr-code.service';
import { ShipmentService } from '../../core/services/shipment.service';
import { ToastService } from '../../core/services/toast.service';
import { Agent } from '../../core/interfaces/auth.interface';
import { makeAgent } from '../../core/testing/agent.fixture';
import { Home } from './home';

function setup(options: { loggedIn: boolean; agents?: Agent[]; followed?: Agent[]; pendingInvite?: string }) {
  const getAvailableAgents = vi.fn(() =>
    of({ agents: options.agents ?? [], pagination: { has_more: false } }),
  );
  const list = vi.fn(() =>
    of({
      data: {
        agents: options.followed ?? [],
        pagination: { current_page: 1, has_more: false, total: (options.followed ?? []).length },
      },
    }),
  );
  const follow = vi.fn(() => of({ data: { following: true } }));
  const takePendingInvite = vi.fn(() => options.pendingInvite ?? null);
  const user = options.loggedIn ? makeAgent({ role: 'Buyer' }) : null;
  TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      provideRouter([]),
      { provide: AgentService, useValue: { getAvailableAgents } },
      { provide: AgentFollowService, useValue: { list, follow, takePendingInvite } },
      { provide: AuthService, useValue: { getUser: () => user, isAuthenticated: () => options.loggedIn } },
      {
        provide: ShipmentService,
        useValue: { getUserShipments: () => of({ success: true, data: { shipments: [] } }) },
      },
      { provide: QrCodeService, useValue: { getAll: () => of({ data: [] }) } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  return { getAvailableAgents, list, follow };
}

describe('Home agent cards', () => {
  it('uses saved currencies across price cards and removes the blue verification check', async () => {
    const tzs = makeAgent();
    const usd = makeAgent({ id: 2, currency: 'USD', base_price: 15 });
    const eur = makeAgent({ id: 3, currency: 'EUR', base_price: 0 });
    setup({ loggedIn: false, agents: [tzs, usd, eur] });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(Home);
    const component = fixture.componentInstance;
    // Exercise each price-card template independently of category ranking rules.
    vi.spyOn(component, 'categorizeAgents').mockImplementation(() => {
      component.bestValueAgents = [tzs];
      component.newAgents = [usd];
      component.verifiedAgents = [eur];
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('TZS 12,000/kg');
    expect(text).toContain('USD 15/kg');
    expect(text).toContain('EUR 0/kg');
    expect(text).not.toContain('$');
    expect(fixture.nativeElement.querySelector('.fa-check')).toBeNull();
  });
});

describe('Home for signed-in users', () => {
  it('shows only followed agents and never loads the marketplace agent list', async () => {
    const followed = makeAgent({ id: 7, uuid: 'followed-uuid', firstname: 'Followed', lastname: 'Agent' });
    const { getAvailableAgents, list } = setup({ loggedIn: true, followed: [followed] });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;
    expect(list).toHaveBeenCalledWith(1);
    expect(getAvailableAgents).not.toHaveBeenCalled();
    expect(text).toContain('Agents You Follow');
    expect(text).toContain('Followed Agent');
    for (const heading of ['Nearby Agents', 'Top Rated', 'Express Shipping', 'Best Value', 'New Agents', 'Verified']) {
      expect(text).not.toContain(heading);
    }
  });

  it('follows the agent from an invite link opened before sign-in, then lists followed agents', async () => {
    const { follow, list } = setup({ loggedIn: true, pendingInvite: 'invited-agent-uuid' });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(follow).toHaveBeenCalledWith('invited-agent-uuid');
    expect(list).toHaveBeenCalledAfter(follow);
  });

  it('shows an empty state when the user follows no agents', async () => {
    const { getAvailableAgents } = setup({ loggedIn: true });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;
    expect(getAvailableAgents).not.toHaveBeenCalled();
    expect(text).toContain('You are not following any agents yet');
  });
});
