import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-agent-page',
  standalone: true,
  imports: [ CommonModule ],
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

      recentReviews: [
        {
          name: 'Michael K.',
          rating: 5,
          comment: 'Very fast delivery and great communication. Highly recommended!'
        },
        {
          name: 'Sarah T.',
          rating: 4.5,
          comment: 'Good pricing and reliable service. Will use again.'
        },
        {
          name: 'David L.',
          rating: 5,
          comment: 'Handled my bulk order professionally. Everything arrived on time.'
        },
        {
          name: 'Amina R.',
          rating: 4,
          comment: 'Smooth process overall, just slight delay but well communicated.'
        },
        {
          name: 'John P.',
          rating: 5,
          comment: 'Excellent agent! Helped me source quality electronics at a great price.'
        }
      ]
    };
  }

}
