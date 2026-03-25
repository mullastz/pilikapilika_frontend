import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Footer } from "../../shared/footer/footer";

@Component({
  selector: 'app-track-shipping',
  imports: [CommonModule, Footer],
  templateUrl: './track-shipping.html',
  styleUrl: './track-shipping.css',
})
export class TrackShipping {
  // Add this inside your TrackShippingComponent class
productPhotos: string[] = [
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9',   // Smartphone example
  'https://images.unsplash.com/photo-1772618370416-1f579633d698?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjB8fEVsZWN0cm9uaWNzJTIwcGFja2FnaW5nfGVufDB8fDB8fHww',   // Boxed product
  'https://images.unsplash.com/photo-1772683709338-82c262d55f8a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8RWxlY3Ryb25pY3MlMjBwYWNrYWdpbmd8ZW58MHx8MHx8fDA%3D',   // Electronics packaging
  'https://images.unsplash.com/photo-1772683709276-47c355c82b85?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fEVsZWN0cm9uaWNzJTIwcGFja2FnaW5nfGVufDB8fDB8fHww'    // Another angle
];

// Add this inside your TrackShippingComponent class
routeStops: string[] = [
  'Beijing, China',
  'Dubai, UAE',
  'Egypt',
  'Cape Town, South Africa',
  'Dar-es-Salaam, Tanzania',
  'Arusha, Tanzania'
];

// Agent Information
agent = {
  name: 'Juma Bakari',
  rating: 4.9,
  location: 'Wang Zu, China',
  price: '$ 20 / 1kg',
  image: 'assets/landingpage_images/profile4.jpg'
};

}
