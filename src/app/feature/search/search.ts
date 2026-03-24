import { Component } from '@angular/core';
import { CommonModule, Location  } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.html',
  styleUrl: './search.css',
})
export class Search {
  searchQuery = '';
  selectedFilter: string | null = null;

  constructor( private route: ActivatedRoute, private location: Location) {}

  filters = [
    'All',
    'Electronics',
    'Fashion',
    'Home Appliances',
    'Wholesale Sourcing',
    'Air Freight',
    'Sea Freight',
    'Local Delivery',
  ];

  searchResults = [
    {
      id: 1,
      name: 'Agent #101',
      location: 'Guangzhou, China',
      rating: 4.8,
      reviews: 126,
      price: '$18/kg',
      specializations: ['Electronics', 'Wholesale Sourcing'],
      image: 'assets/landingpage_images/profile4.jpg',
    },
    {
      id: 2,
      name: 'Agent #102',
      location: 'Istanbul, Turkey',
      rating: 4.6,
      reviews: 89,
      price: '$15/kg',
      specializations: ['Fashion', 'Home Appliances'],
      image: 'assets/landingpage_images/profile4.jpg',
    },
    {
      id: 3,
      name: 'Agent #103',
      location: 'Dubai, UAE',
      rating: 4.9,
      reviews: 234,
      price: '$22/kg',
      specializations: ['Electronics', 'Fashion'],
      image: 'assets/landingpage_images/profile4.jpg',
    },
    {
      id: 4,
      name: 'Agent #104',
      location: 'Shanghai, China',
      rating: 4.5,
      reviews: 67,
      price: '$16/kg',
      specializations: ['Home Appliances', 'Wholesale Sourcing'],
      image: 'assets/landingpage_images/profile4.jpg',
    },
    {
      id: 5,
      name: 'Agent #105',
      location: 'Mumbai, India',
      rating: 4.7,
      reviews: 156,
      price: '$14/kg',
      specializations: ['Fashion', 'Local Delivery'],
      image: 'assets/landingpage_images/profile4.jpg',
    },
  ];

  goBack() {
    this.location.back();
  }
  get filteredResults() {
    let results = this.searchResults;

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      results = results.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.location.toLowerCase().includes(query) ||
          agent.specializations.some((s) => s.toLowerCase().includes(query))
      );
    }

    if (this.selectedFilter && this.selectedFilter !== 'All') {
      results = results.filter((agent) =>
        agent.specializations.includes(this.selectedFilter!)
      );
    }

    return results;
  }

  selectFilter(filter: string) {
    this.selectedFilter = filter === 'All' ? null : filter;
  }

  clearSearch() {
    this.searchQuery = '';
    this.selectedFilter = null;
  }
}
