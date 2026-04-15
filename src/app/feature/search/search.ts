import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location  } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Agent } from '../../core/interfaces/auth.interface';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.html',
  styleUrl: './search.css',
})
export class Search implements OnInit {
  searchQuery = '';
  agents: Agent[] = [];
  isLoading = true;
  error: string | null = null;

  // Filter states
  selectedSpecialization: string | null = null;
  selectedTransport: string | null = null;
  selectedPriceRange: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAgents();
  }

  loadAgents(): void {
    this.isLoading = true;
    this.error = null;
    console.log('Search: Loading agents with filters...');

    // Build search params from current filters
    const params: { specialization?: string; transport?: string; min_price?: number; max_price?: number; q?: string } = {};

    if (this.selectedSpecialization && this.selectedSpecialization !== 'All') {
      params.specialization = this.selectedSpecialization;
    }
    if (this.selectedTransport && this.selectedTransport !== 'all') {
      params.transport = this.selectedTransport;
    }
    if (this.selectedPriceRange && this.selectedPriceRange !== 'All') {
      switch (this.selectedPriceRange) {
        case 'Under $15/kg':
          params.max_price = 15;
          break;
        case '$15 - $20/kg':
          params.min_price = 15;
          params.max_price = 20;
          break;
        case '$20 - $25/kg':
          params.min_price = 20;
          params.max_price = 25;
          break;
        case 'Above $25/kg':
          params.min_price = 25;
          break;
      }
    }
    if (this.searchQuery.trim()) {
      params.q = this.searchQuery.trim();
    }

    this.authService.searchAgents(params).subscribe({
      next: (agents) => {
        console.log('Search: Agents loaded:', agents);
        this.agents = agents;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Search: Error loading agents:', err);
        this.error = err.error?.message || 'Failed to load agents';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getAgentName(agent: Agent): string {
    return `${agent.firstname || ''} ${agent.lastname || ''}`.trim() || 'Unknown Agent';
  }

  getAgentLocation(agent: Agent): string {
    const region = agent.region?.name || '';
    const district = agent.district?.name || '';
    if (region && district) return `${region}, ${district}`;
    return region || district || 'Unknown Location';
  }

  getAgentPrice(agent: Agent): string {
    return agent.base_price ? `$${agent.base_price}/kg` : 'Contact for price';
  }

  getAgentImage(agent: Agent): string {
    return agent.image || 'assets/landingpage_images/profile4.jpg';
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

  priceRanges = [
    'All',
    'Under $15/kg',
    '$15 - $20/kg',
    '$20 - $25/kg',
    'Above $25/kg',
  ];

  goBack() {
    this.location.back();
  }
  get filteredResults() {
    // Results are already filtered server-side, just return agents
    return this.agents;
  }

  selectSpecialization(filter: string) {
    this.selectedSpecialization = filter === 'All' ? null : filter;
    this.loadAgents(); // Reload with new filter
  }

  selectTransport(filter: string) {
    this.selectedTransport = filter === 'all' ? null : filter;
    this.loadAgents(); // Reload with new filter
  }

  selectPriceRange(filter: string) {
    this.selectedPriceRange = filter === 'All' ? null : filter;
    this.loadAgents(); // Reload with new filter
  }

  onSearch(): void {
    this.loadAgents(); // Reload with search query
  }

  clearSearch() {
    this.searchQuery = '';
    this.selectedSpecialization = null;
    this.selectedTransport = null;
    this.selectedPriceRange = null;
    this.loadAgents(); // Reload with cleared filters
  }

  hasActiveFilters(): boolean {
    return !!this.selectedSpecialization || !!this.selectedTransport || !!this.selectedPriceRange;
  }

  viewAgent(agentId: number) {
    this.router.navigate(['/agent', agentId]);
  }
}
