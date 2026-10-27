import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule, Location  } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AgentService } from '../../core/services/agent.service';
import { Agent } from '../../core/interfaces/auth.interface';
import { formatAgentPrice, normalizeCurrencyCode } from '../../core/utils/agent-price.util';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.html',
  styleUrl: './search.css',
})
export class Search implements OnInit, OnDestroy {
  // Combined search query
  searchQuery = '';
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  agents: Agent[] = [];
  isLoading = true; // Initial page load
  isLoadingResults = false; // Only for results refresh
  error: string | null = null;

  // Filter states
  selectedSpecialization: string | null = null;
  selectedTransport: string | null = null;
  selectedPriceRange: string | null = null;
  selectedPriceCurrency: string | null = null;

  // Collapsible sections - collapsed by default
  isSpecCollapsed = true;
  isTransportCollapsed = true;
  isPriceCollapsed = true;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private agentService: AgentService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Setup debounced search - updates as user types with 300ms delay
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.performSearch();
    });
    this.loadAgents();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  loadAgents(): void {
    this.isLoading = true;
    this.isLoadingResults = true;
    this.error = null;
    this.performSearch();
  }

  private performSearch(): void {
    // Build search params from current filters and search query
    const params: { specialization?: string; transport?: string; min_price?: number; max_price?: number; q?: string } = {};

    if (this.selectedSpecialization && this.selectedSpecialization !== 'All') {
      params.specialization = this.selectedSpecialization;
    }
    if (this.selectedTransport && this.selectedTransport !== 'all') {
      params.transport = this.selectedTransport;
    }
    if (this.selectedPriceCurrency && this.selectedPriceRange) {
      const range = this.priceRanges.find((option) => option.value === this.selectedPriceRange);
      if (range?.min !== undefined) params.min_price = range.min;
      if (range?.max !== undefined) params.max_price = range.max;
    }
    // Combined search query - searches name, region, district on backend
    if (this.searchQuery.trim()) {
      params.q = this.searchQuery.trim();
    }

    this.agentService.searchAgents(params).subscribe({
      next: (agents: Agent[]) => {
        this.agents = agents;
        this.isLoading = false;
        this.isLoadingResults = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.error = err.error?.message || 'Failed to load agents';
        this.isLoading = false;
        this.isLoadingResults = false;
        this.cdr.markForCheck();
      }
    });
  }

  getAgentName(agent: Agent): string {
    return `${agent.firstname || ''} ${agent.lastname || ''}`.trim() || 'Unknown Agent';
  }

  getAgentLocation(agent: Agent): string {
    const region = agent.region || '';
    const district = agent.district || '';
    if (region && district) return `${region}, ${district}`;
    return region || district || 'Unknown Location';
  }

  getAgentPrice(agent: Agent): string {
    return formatAgentPrice(agent);
  }

  getAgentImage(agent: Agent): string {
    return agent.profile_photo || agent.image || 'assets/landingpage_images/profile4.jpg';
  }

  // Filter options - matching agent-details.ts
  specializations = [
    'All',
    'Electronics',
    'Fashion',
    'Home Appliances',
    'Wholesale Sourcing',
    'Documents',
    'Food & Beverages',
    'Medical Supplies',
    'Furniture',
    'Fragile Items',
    'Same-Day Delivery'
  ];

  // Transport filter with value + label mapping
  transportMethods = [
    { value: 'all', label: 'All' },
    { value: 'motorcycle', label: 'Motorcycle' },
    { value: 'bicycle', label: 'Bicycle' },
    { value: 'car', label: 'Car' },
    { value: 'van', label: 'Van' },
    { value: 'truck', label: 'Truck' },
    { value: 'air', label: 'Air Freight' },
    { value: 'sea', label: 'Sea Freight' },
    { value: 'local', label: 'Local Delivery' }
  ];

  get currencyOptions(): string[] {
    return [...new Set([
      'TZS', 'USD', 'EUR', 'GBP', 'KES', 'UGX',
      ...this.agents.map((agent) => normalizeCurrencyCode(agent.currency)).filter(Boolean),
      ...(this.selectedPriceCurrency ? [this.selectedPriceCurrency] : []),
    ])];
  }

  get priceRanges(): { value: string; label: string; min?: number; max?: number }[] {
    const currency = this.selectedPriceCurrency;
    return [
      { value: 'all', label: 'All prices' },
      { value: 'under-15', label: `Under ${currency} 15/kg`, max: 15 },
      { value: '15-20', label: `${currency} 15 - 20/kg`, min: 15, max: 20 },
      { value: '20-25', label: `${currency} 20 - 25/kg`, min: 20, max: 25 },
      { value: 'above-25', label: `Above ${currency} 25/kg`, min: 25 },
    ];
  }

  get selectedPriceLabel(): string {
    return this.priceRanges.find((option) => option.value === this.selectedPriceRange)?.label
      || this.selectedPriceCurrency || '';
  }

  goBack() {
    this.location.back();
  }
  get filteredResults() {
    // The search API returns the complete result set, without pagination.
    // Apply the selected currency to its price-filtered results; no FX conversion.
    return this.selectedPriceCurrency
      ? this.agents.filter((agent) => normalizeCurrencyCode(agent.currency) === this.selectedPriceCurrency)
      : this.agents;
  }

  selectSpecialization(filter: string) {
    this.selectedSpecialization = filter === 'All' ? null : filter;
    this.onSearch(); // Use partial loading
  }

  selectTransport(filter: string) {
    this.selectedTransport = filter === 'all' ? null : filter;
    this.onSearch(); // Use partial loading
  }

  selectPriceRange(filter: string) {
    if (!this.selectedPriceCurrency) return;
    this.selectedPriceRange = filter === 'all' ? null : filter;
    this.onSearch(); // Use partial loading
  }

  selectPriceCurrency(currency: string): void {
    this.selectedPriceCurrency = normalizeCurrencyCode(currency) || null;
    this.selectedPriceRange = null;
    this.onSearch();
  }

  onSearch(): void {
    this.isLoadingResults = true;
    this.performSearch();
  }

  clearSearch() {
    this.searchQuery = '';
    this.selectedSpecialization = null;
    this.selectedTransport = null;
    this.selectedPriceRange = null;
    this.selectedPriceCurrency = null;
    this.isLoadingResults = true;
    this.performSearch();
  }

  hasActiveFilters(): boolean {
    return !!this.selectedSpecialization || !!this.selectedTransport || !!this.selectedPriceRange || !!this.selectedPriceCurrency || !!this.searchQuery.trim();
  }

  clearQuery() {
    this.searchQuery = '';
    this.onSearchInput();
  }

  toggleSpec() {
    this.isSpecCollapsed = !this.isSpecCollapsed;
  }

  toggleTransport() {
    this.isTransportCollapsed = !this.isTransportCollapsed;
  }

  togglePrice() {
    this.isPriceCollapsed = !this.isPriceCollapsed;
  }

  viewAgent(agentId: number) {
    this.router.navigate(['/agent', agentId]);
  }
}
