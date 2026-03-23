import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';

@Component({
  selector: 'app-shipping',
  imports: [ CommonModule ],
  templateUrl: './shipping.html',
  styleUrl: './shipping.css',
})
export class Shipping {
  constructor(private location: Location) {}

  goBack() {
    this.location.back();
  }

  shipments = [
    {
      title: 'Electronics Package',
      from: 'Guangzhou, China',
      to: 'Arusha, Tanzania',
      price: '$45',
      status: 'In Transit'
    },
    {
      title: 'Clothes Shipment',
      from: 'Istanbul, Turkey',
      to: 'Dar es Salaam',
      price: '$30',
      status: 'Delivered'
    },
    {
      title: 'Shoes Order',
      from: 'Dubai, UAE',
      to: 'Nairobi, Kenya',
      price: '$25',
      status: 'Pending'
    }
  ];

  getStatusClass(status: string) {
    switch (status) {
      case 'Delivered':
        return 'bg-green-100 text-green-600';
      case 'In Transit':
        return 'bg-blue-100 text-blue-600';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-gray-200 text-gray-600';
    }
  }
} 
