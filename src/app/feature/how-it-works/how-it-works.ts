import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../../shared/header/header';
import { Footer } from '../../shared/footer/footer';

@Component({
  selector: 'app-how-it-works',
  imports: [RouterLink, Header, Footer],
  templateUrl: './how-it-works.html',
})
export class HowItWorks {
  readonly steps = [
    { number: '01', icon: 'fa-magnifying-glass', title: 'Find an agent', description: 'Search by name, region, district, service, or transport method. Open an agent profile to review their services, location, and available pricing before you choose.' },
    { number: '02', icon: 'fa-box', title: 'Prepare your parcel', description: 'Create your product QR code or package details. Include the item description, quantity, supplier information, and any photos that will help your agent identify the goods.' },
    { number: '03', icon: 'fa-calendar-check', title: 'Book your shipment', description: 'Select your agent and parcels, enter the pickup and destination details, and submit your request. Your agent reviews the request and confirms or rejects the booking.' },
    { number: '04', icon: 'fa-truck-fast', title: 'Follow shipment updates', description: 'Open My Shipping in your account to follow status updates as your goods move through the delivery process. Use Messages to discuss shipment details with your agent.' },
    { number: '05', icon: 'fa-circle-check', title: 'Receive and confirm', description: 'Check your goods when they arrive and follow the delivery confirmation steps in your account. Where requested, scan the product QR code to confirm receipt.' },
  ];
}
