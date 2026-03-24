import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Footer } from '../../shared/footer/footer';

@Component({
  selector: 'app-agent-page',
  standalone: true,
  imports: [ CommonModule, Footer ],
  templateUrl: './agent-page.html',
  styleUrl: './agent-page.css',
})
export class AgentPage {


  constructor( private route: ActivatedRoute, private location: Location) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    console.log('Agent ID:', id);

    this.loadAgent(id);
  }
  goBack() {
    this.location.back();
  }
  agent: any;
  loadAgent(id: string | null) {
    this.agent = {
      name: 'Agent #' + id,
      location: 'Guangzhou, China',
      rating: 4.8,
      reviews: 126,
      deliveries: 542,
      deliveryTime: '3–5 days',
      price: '$18/kg',
      successRate: 96,
      image: 'assets/landingpage_images/profile4.jpg',

      bio: 'Experienced sourcing and logistics agent specializing in fast and reliable international deliveries. Handles procurement, quality checks, and shipping coordination.',

      specializations: [
        'Electronics',
        'Fashion',
        'Home Appliances',
        'Wholesale Sourcing'
      ],

      transport: [
        { icon: 'fa-solid fa-plane', label: 'Air Freight' },
        { icon: 'fa-solid fa-ship', label: 'Sea Freight' },
        { icon: 'fa-solid fa-truck', label: 'Local Delivery' }
      ],

     testimonials : [
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
      ]
    };
  }

}
