import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';

@Component({
  selector: 'app-help-center',
  imports: [ CommonModule ],
  templateUrl: './help-center.html',
  styleUrl: './help-center.css',
})
export class HelpCenter {

  constructor(private location: Location) {}

  goBack() {
    this.location.back();
  }

  activeIndex: number | null = null;

  toggle(index: number) {
    this.activeIndex = this.activeIndex === index ? null : index;
  }

  faqs = [
    {
      question: 'How do I track my shipment?',
      answer: 'Go to My Shipping and click Track on your active shipment.'
    },
    {
      question: 'How do I become an agent?',
      answer: 'Use the Become Agent option on the home page and complete registration.'
    },
    {
      question: 'How are payments handled?',
      answer: 'Payments are secured and only released after successful delivery.'
    },
    {
      question: 'What if my package is delayed?',
      answer: 'You can contact the agent or support for real-time assistance.'
    }
  ]; 
}
