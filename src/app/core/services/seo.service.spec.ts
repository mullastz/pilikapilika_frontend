import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SeoService, SITE_URL, hasSearchFiltersInUrl } from './seo.service';

describe('SeoService', () => {
  let seo: SeoService;
  let document: Document;
  let events: Subject<NavigationStart | NavigationEnd>;

  beforeEach(() => {
    events = new Subject();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { events } }] });
    seo = TestBed.inject(SeoService);
    document = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    document.querySelector('link[rel="canonical"]')?.remove();
    document.getElementById('site-schema')?.remove();
    document.querySelectorAll('meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], meta[name="description"]').forEach(tag => tag.remove());
  });

  it('indexes public routes and removes query strings from canonical URLs', () => {
    seo.start();
    events.next(new NavigationEnd(1, '/about-us?ref=share', '/about-us?ref=share'));
    expect(TestBed.inject(Title).getTitle()).toContain('About Pilikapilika');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(`${SITE_URL}/about-us/`);
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('index, follow');
    expect(JSON.parse(document.getElementById('site-schema')!.textContent!)).toHaveProperty('@graph');
  });

  it('clears public metadata when navigating to a private page', () => {
    seo.start();
    events.next(new NavigationEnd(1, '/', '/'));
    events.next(new NavigationStart(2, '/messages?userId=private'));
    events.next(new NavigationEnd(2, '/messages?userId=private', '/messages?userId=private'));
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, follow');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(TestBed.inject(Meta).getTag('property="og:url"')).toBeNull();
    expect(document.getElementById('site-schema')).toBeNull();
  });

  it.each(['/search', '/how-it-works', '/contact-us'])('indexes the public page %s', path => {
    seo.start();
    events.next(new NavigationEnd(1, path, path));
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('index, follow');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(`${SITE_URL}${path}/`);
  });

  it('excludes filtered searches and restores indexing for the main directory', () => {
    seo.start();
    events.next(new NavigationEnd(1, '/search?q=Arusha', '/search?q=Arusha'));
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, follow');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    events.next(new NavigationEnd(2, '/search?utm_source=share', '/search?utm_source=share'));
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('index, follow');
  });

  it.each(['q=Arusha', 'transport=sea', 'specialization=Documents', 'currency=TZS', 'page=2'])('recognizes a search variation: %s', query => {
    expect(hasSearchFiltersInUrl(`/search?${query}`)).toBe(true);
    expect(hasSearchFiltersInUrl('/search?q=&utm_source=share')).toBe(false);
  });

  it('keeps agent metadata applied before NavigationEnd, as happens with cached HTTP', () => {
    seo.start();
    events.next(new NavigationStart(1, '/agent/42'));
    seo.update({ title: 'Asha | Pilikapilika', description: 'Delivery services in Arusha.', path: '/agent/agent-uuid', index: true });
    events.next(new NavigationEnd(1, '/agent/42', '/agent/42'));
    expect(TestBed.inject(Title).getTitle()).toBe('Asha | Pilikapilika');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(`${SITE_URL}/agent/agent-uuid/`);
    seo.privatePage();
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, follow');
  });
});
