import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Header } from '../../shared/header/header';
import { Footer } from '../../shared/footer/footer';
import { PageHero } from '../../shared/components/page-hero/page-hero';
import { ContentService, SiteContent } from '../../core/services/content.service';
import { resolveImageUrl } from '../../core/utils/image-url.util';

@Component({
  selector: 'app-about-us',
  imports: [CommonModule, Header, Footer, PageHero],
  templateUrl: './about-us.html',
})
export class AboutUs implements OnInit {
  content = signal<SiteContent>({});
  loading = signal(true);

  constructor(private contentService: ContentService) {}

  ngOnInit(): void {
    this.contentService.getContent().subscribe((data) => {
      this.content.set(data);
      this.loading.set(false);
    });
  }

  get(key: keyof SiteContent, fallback: string): string {
    return this.content()[key] || fallback;
  }

  imageUrl(): string {
    const img = this.content()['about_us_image'];
    return img ? resolveImageUrl(img, '') : '';
  }
}
