import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ContentService, SiteContent } from '../../core/services/content.service';

@Component({
  selector: 'app-help-center',
  imports: [ CommonModule, RouterLink ],
  templateUrl: './help-center.html',
  styleUrl: './help-center.css',
})
export class HelpCenter implements OnInit {
  private readonly contentService = inject(ContentService);
  private readonly destroyRef = inject(DestroyRef);
  readonly content = signal<SiteContent>({});

  ngOnInit(): void {
    this.contentService.getContent(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(content => this.content.set(content));
  }

  get supportEmail(): string { return this.content().contact_email?.trim() || ''; }
  get supportPhone(): string { return this.content().contact_phone?.trim() || ''; }
  get supportWhatsapp(): string { return this.content().contact_whatsapp?.trim() || ''; }

  get phoneLink(): string {
    const number = this.supportPhone.replace(/[^+\d]/g, '');
    return /\d/.test(number) ? `tel:${number}` : '';
  }

  get whatsappLink(): string {
    const number = this.supportWhatsapp.replace(/[\s().+-]/g, '');
    return /^[1-9]\d{6,14}$/.test(number) ? `https://wa.me/${number}` : '';
  }

  readonly publicLinks = [
    { path: '/search', label: 'Search Agents', icon: 'fa-magnifying-glass', description: 'Find an agent for your shipment.' },
    { path: '/how-it-works', label: 'How It Works', icon: 'fa-circle-question', description: 'Learn how to book and follow a shipment.' },
    { path: '/about-us', label: 'About Us', icon: 'fa-circle-info', description: 'Get to know Pilikapilika.' },
    { path: '/contact-us', label: 'Contact Us', icon: 'fa-envelope', description: 'Find our support contact details.' },
  ];

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
