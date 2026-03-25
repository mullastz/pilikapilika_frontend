import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Footer } from '../../shared/footer/footer';
import { Header } from '../../shared/header/header';
import { Router } from '@angular/router';

import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-landing-page',
  imports: [ CommonModule, Footer, Header, RouterLink ],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css'
})

export class LandingPage {
  @ViewChild('agentsContainer') agentsContainer!: ElementRef;
  @ViewChild('topAgentsContainer') topAgentsContainer!: ElementRef;

constructor(private router: Router) {}

goTo(route: string) {
  this.router.navigate([route]);
}

activities = [
  { icon: 'fa-solid fa-user', label: 'Become Agent', route: '/sign-up' },
  { icon: 'fa-solid fa-qrcode', label: 'Generate QRcode', route: '/qr-generator' },
  { icon: 'fa-solid fa-magnifying-glass', label: 'Search Agent', route: '/search' },
  { icon: 'fa-solid fa-location-crosshairs', label: 'Track Shipping', route: '/account/shipping' },
  { icon: 'fa-solid fa-handshake', label: 'Negotiate', route: '/search' }, // same page
];

agents = [
  {
    name: 'Juma Bakari',
    rating: 4.9,
    location: 'Wang Zu, China',
    price: '$ 20 / 1kg',
    image: 'assets/landingpage_images/profile4.jpg'
  },
  {
    name: 'Juma Bakari',
    rating: 4.9,
    location: 'Wang Zu, China',
    price: '$ 20 / 1kg',
    image: 'assets/landingpage_images/profile4.jpg'
  },  
  {
    name: 'Juma Bakari',
    rating: 4.9,
    location: 'Wang Zu, China',
    price: '$ 20 / 1kg',
    image: 'assets/landingpage_images/profile4.jpg'
  },  
  {
    name: 'Juma Bakari',
    rating: 4.9,
    location: 'Wang Zu, China',
    price: '$ 20 / 1kg',
    image: 'assets/landingpage_images/profile4.jpg'
  },  
  {
    name: 'Juma Bakari',
    rating: 4.9,
    location: 'Wang Zu, China',
    price: '$ 20 / 1kg',
    image: 'assets/landingpage_images/profile4.jpg'
  },  
  {
    name: 'Juma Bakari',
    rating: 4.9,
    location: 'Wang Zu, China',
    price: '$ 20 / 1kg',
    image: 'assets/landingpage_images/profile4.jpg'
  },
]; 

topAgents = [...this.agents];

testimonials = [
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },  
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },  
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },  
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },  
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },
];

scrollLeft(containerId: string) {
  const container = containerId === 'topAgentsContainer' 
    ? this.topAgentsContainer 
    : this.agentsContainer;

  if (container?.nativeElement) {
    container.nativeElement.scrollBy({
      left: -320,
      behavior: 'smooth'
    });
  }
}

scrollRight(containerId: string) {
  const container = containerId === 'topAgentsContainer' 
    ? this.topAgentsContainer 
    : this.agentsContainer;

  if (container?.nativeElement) {
    container.nativeElement.scrollBy({
      left: 320,
      behavior: 'smooth'
    });
  }
}
}
