import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { QrCodeService } from '../../core/services/qr-code.service';
import { ShipmentService } from '../../core/services/shipment.service';
import { ToastService } from '../../core/services/toast.service';
import { makeAgent } from '../../core/testing/agent.fixture';
import { Home } from './home';

describe('Home agent cards', () => {
  it('uses saved currencies across price cards and removes the blue verification check', async () => {
    const tzs = makeAgent();
    const usd = makeAgent({ id: 2, currency: 'USD', base_price: 15 });
    const eur = makeAgent({ id: 3, currency: 'EUR', base_price: 0 });
    const user = makeAgent({ role: 'Buyer' });
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        {
          provide: AgentService,
          useValue: {
            getAvailableAgents: () =>
              of({ agents: [tzs, usd, eur], pagination: { has_more: false } }),
          },
        },
        { provide: AuthService, useValue: { getUser: () => user, isAuthenticated: () => true } },
        {
          provide: ShipmentService,
          useValue: { getUserShipments: () => of({ success: true, data: { shipments: [] } }) },
        },
        { provide: QrCodeService, useValue: { getAll: () => of({ data: [] }) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();
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
