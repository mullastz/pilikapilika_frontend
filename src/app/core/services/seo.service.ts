import { DOCUMENT } from '@angular/common';
import { Injectable, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

export interface PageSeo {
  title: string;
  description: string;
  path?: string;
  index?: boolean;
  image?: string;
}

export const SITE_URL = 'https://pilikapilika.com';
export const SITE_DESCRIPTION = 'Find logistics and delivery agents in Tanzania. Compare services, book shipments, and follow delivery updates with Pilikapilika.';

export function hasSearchFiltersInUrl(url: string): boolean {
  const params = new URL(url, SITE_URL).searchParams;
  return ['q', 'specialization', 'transport', 'min_price', 'max_price', 'currency', 'region_id', 'page']
    .some(key => Boolean(params.get(key)?.trim()));
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationStart) this.privatePage();
      if (event instanceof NavigationEnd) {
        const path = event.urlAfterRedirects.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
        if (path === '/') {
          this.update({ title: 'Pilikapilika | Logistics & Delivery Agents in Tanzania', description: SITE_DESCRIPTION, path, index: true });
        } else if (path === '/about-us') {
          this.update({ title: 'About Pilikapilika | Logistics Marketplace in Tanzania', description: 'Learn how Pilikapilika connects customers and businesses with logistics agents for shipping, delivery, and shipment updates.', path, index: true });
        } else if (path === '/search') {
          this.searchPage(hasSearchFiltersInUrl(event.urlAfterRedirects));
        } else if (path === '/how-it-works') {
          this.update({ title: 'How Pilikapilika Works | Find Agents & Book Shipments', description: 'Learn how to find a logistics agent, prepare your parcel, book a shipment, follow delivery updates, and confirm receipt with Pilikapilika.', path, index: true });
        } else if (path === '/contact-us') {
          this.update({ title: 'Contact Pilikapilika | Logistics Marketplace Support', description: 'Contact Pilikapilika for platform support and find help with agent discovery, shipment bookings, and delivery updates.', path, index: true });
        } else if (!/^\/agent\/[^/]+$/.test(path)) {
          this.privatePage();
        }
        // AgentPage sets its metadata only after a public profile has loaded.
      }
    });
  }

  privatePage(): void {
    this.update({ title: 'Pilikapilika', description: SITE_DESCRIPTION, index: false });
  }

  searchPage(filtered = false): void {
    this.update({
      title: 'Search Logistics Agents in Tanzania | Pilikapilika',
      description: 'Find logistics agents by name, location, service, or transport method. Compare agent profiles and available services on Pilikapilika.',
      path: '/search',
      index: !filtered,
    });
  }

  update(page: PageSeo): void {
    const canonical = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const image = page.image || `${SITE_URL}/assets/landingpage_images/logistics.webp`;
    const url = page.path ? `${SITE_URL}${page.path === '/' ? '/' : `${page.path.replace(/\/+$/, '')}/`}` : undefined;
    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ name: 'robots', content: page.index ? 'index, follow' : 'noindex, follow' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'Pilikapilika' });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    if (url && page.index) {
      const link = canonical || this.document.createElement('link');
      link.rel = 'canonical';
      link.href = url;
      if (!canonical) this.document.head.appendChild(link);
      this.meta.updateTag({ property: 'og:url', content: url });
    } else {
      canonical?.remove();
      this.meta.removeTag('property="og:url"');
    }

    this.document.getElementById('site-schema')?.remove();
    if (page.index) {
      const schema = this.document.createElement('script');
      schema.id = 'site-schema';
      schema.type = 'application/ld+json';
      schema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Pilikapilika', url: `${SITE_URL}/` },
          { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Pilikapilika', url: `${SITE_URL}/`, publisher: { '@id': `${SITE_URL}/#organization` } },
        ],
      });
      this.document.head.appendChild(schema);
    }
  }
}
