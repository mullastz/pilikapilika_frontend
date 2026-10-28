import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService, SiteContent } from '../../core/services/content.service';
import { Header } from '../../shared/header/header';
import { Footer } from '../../shared/footer/footer';

@Component({
  selector: 'app-contact-us',
  imports: [RouterLink, Header, Footer],
  templateUrl: './contact-us.html',
})
export class ContactUs implements OnInit {
  private readonly contentService = inject(ContentService);
  readonly content = signal<SiteContent>({});

  ngOnInit(): void {
    this.contentService.getContent().subscribe(content => this.content.set(content));
  }

  get email(): string { return this.content().contact_email?.trim() || ''; }
  get phone(): string { return this.content().contact_phone?.trim() || ''; }
  get hours(): string { return this.content().contact_hours?.trim() || ''; }
  get phoneLink(): string { return `tel:${this.phone.replace(/[^+\d]/g, '')}`; }
}
