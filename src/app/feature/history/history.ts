import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';

@Component({
  selector: 'app-history',
  imports: [ CommonModule ],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class History {

  constructor(private location: Location) {}

  goBack() {
    this.location.back();
  }

  filter = 'all';

  history = [
    {
      title: 'Electronics Package',
      from: 'China',
      to: 'Arusha',
      price: '$45',
      status: 'Delivered',
      date: '12 Mar 2026'
    },
    {
      title: 'Shoes Order',
      from: 'Dubai',
      to: 'Nairobi',
      price: '$25',
      status: 'Cancelled',
      date: '08 Mar 2026'
    },
    {
      title: 'Clothes Shipment',
      from: 'Turkey',
      to: 'Dar es Salaam',
      price: '$30',
      status: 'Delivered',
      date: '02 Mar 2026'
    }
  ];

  get filteredHistory() {
    if (this.filter === 'all') return this.history;
    return this.history.filter(item => item.status === this.filter);
  }

  setFilter(value: string) {
    this.filter = value;
  }

  tabClass(tab: string) {
    return this.filter === tab
      ? 'px-4 py-2 rounded-full bg-orange-500 text-white text-sm'
      : 'px-4 py-2 rounded-full bg-gray-200 dark:bg-[#111] text-sm dark:text-white';
  }

  getStatusClass(status: string) {
    switch (status) {
      case 'Delivered':
        return 'bg-green-100 text-green-600';
      case 'Cancelled':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-gray-200 text-gray-600';
    }
  }

}
