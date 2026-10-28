import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { Meta } from '@angular/platform-browser';
import { makeAgent } from '../../core/testing/agent.fixture';
import { Search } from './search';

describe('Search agent currencies', () => {
  let fixture: ComponentFixture<Search>;
  let component: Search;
  let searchAgents: ReturnType<typeof vi.fn>;
  const agents = [
    makeAgent({ id: 1, currency: 'TZS', base_price: 12000 }),
    makeAgent({ id: 2, currency: 'USD', base_price: 18 }),
    makeAgent({ id: 3, currency: 'TZS', base_price: 18 }),
    makeAgent({ id: 4, currency: 'TSH', base_price: 0 }),
  ];

  beforeEach(async () => {
    searchAgents = vi.fn((params: { min_price?: number; max_price?: number }) =>
      of(
        agents.filter(
          (agent) =>
            (params.min_price === undefined || (agent.base_price ?? 0) >= params.min_price) &&
            (params.max_price === undefined || (agent.base_price ?? 0) <= params.max_price),
        ),
      ),
    );
    await TestBed.configureTestingModule({
      imports: [Search],
      providers: [provideRouter([]), { provide: AgentService, useValue: { searchAgents } },
        { provide: AuthService, useValue: { isAuthenticated: () => false, getUser: () => null } }],
    }).compileComponents();
    fixture = TestBed.createComponent(Search);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function openPriceFilter(): Promise<void> {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes('By Price'))!.click();
    await fixture.whenStable();
  }

  async function chooseCurrency(currency: string): Promise<void> {
    const select = fixture.nativeElement.querySelector(
      '#agent-price-currency',
    ) as HTMLSelectElement;
    select.value = currency;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
  }

  async function chooseRange(label: string): Promise<void> {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.trim() === label)!.click();
    await fixture.whenStable();
  }

  it('renders saved currencies, including zero prices, without default dollar signs', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('TZS 12,000/kg');
    expect(text).toContain('USD 18/kg');
    expect(text).toContain('TZS 0/kg');
    expect(text).not.toContain('$');
    expect(component.selectedPriceCurrency).toBeNull();
  });

  it('exposes agent profiles as crawlable UUID links with one page heading', () => {
    expect(fixture.nativeElement.querySelectorAll('h1')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Search Agents');
    expect(fixture.nativeElement.querySelectorAll('a[href="/agent/agent-uuid"]')).toHaveLength(4);
  });

  it('uses noindex for active filters and restores indexing when cleared', () => {
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
    component.selectTransport('sea');
    expect(meta.getTag('name="robots"')?.content).toBe('noindex, follow');
    component.clearSearch();
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
  });

  it('does not apply dollar price bounds before a currency is chosen', async () => {
    await openPriceFilter();
    expect(fixture.nativeElement.textContent).toContain('Choose a currency to filter by price.');
    expect(searchAgents).toHaveBeenLastCalledWith({});
    component.selectPriceRange('under-15');
    expect(searchAgents).toHaveBeenCalledTimes(1);
  });

  it('keeps price-filtered results within the explicitly selected currency', async () => {
    await openPriceFilter();
    await chooseCurrency('TZS');
    await chooseRange('TZS 15 - 20/kg');
    expect(searchAgents).toHaveBeenLastCalledWith({ min_price: 15, max_price: 20 });
    expect(component.filteredResults.map((agent) => agent.id)).toEqual([3]);
    expect(fixture.nativeElement.textContent).not.toContain('USD 18/kg');
  });

  it('clears old amount bounds when the currency changes', async () => {
    await openPriceFilter();
    await chooseCurrency('USD');
    await chooseRange('USD 15 - 20/kg');
    expect(component.filteredResults.map((agent) => agent.id)).toEqual([2]);
    await chooseCurrency('TZS');
    expect(component.selectedPriceRange).toBeNull();
    expect(searchAgents).toHaveBeenLastCalledWith({});
    expect(component.filteredResults.map((agent) => agent.id)).toEqual([1, 3, 4]);
  });

  it('resets the currency and price bounds with clear all filters', async () => {
    await openPriceFilter();
    await chooseCurrency('USD');
    await chooseRange('USD 15 - 20/kg');
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.trim() === 'Clear all filters')!.click();
    await fixture.whenStable();
    expect(component.hasActiveFilters()).toBe(false);
    expect(component.selectedPriceCurrency).toBeNull();
    expect(searchAgents).toHaveBeenLastCalledWith({});
    expect(component.filteredResults).toHaveLength(4);
  });
});
