import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService, SiteContent } from '../../core/services/content.service';
import { Header } from '../../shared/header/header';
import { Footer } from '../../shared/footer/footer';
import { PageHero } from '../../shared/components/page-hero/page-hero';
import { resolveImageUrl } from '../../core/utils/image-url.util';

@Component({
  selector: 'app-contact-us',
  imports: [RouterLink, Header, Footer, PageHero],
  templateUrl: './contact-us.html',
})
export class ContactUs implements OnInit {
  private readonly contentService = inject(ContentService);
  readonly content = signal<SiteContent>({});

  ngOnInit(): void {
    this.contentService.getContent().subscribe(content => this.content.set(content));
  }

  get title(): string { return this.content().contact_title?.trim() || 'Contact Pilikapilika'; }
  get subtitle(): string {
    return this.content().contact_subtitle?.trim() || 'Have a question about using Pilikapilika? Find our public support details here, or use the links below to get help with finding an agent and managing a shipment.';
  }
  get imageUrl(): string { return resolveImageUrl(this.content().contact_image, ''); }
  get email(): string { return this.content().contact_email?.trim() || ''; }
  get phone(): string { return this.content().contact_phone?.trim() || ''; }
  get hours(): string { return this.content().contact_hours?.trim() || ''; }
  get phoneLink(): string { return `tel:${this.phone.replace(/[^+\d]/g, '')}`; }
}
