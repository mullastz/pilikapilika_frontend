import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ContentService, SiteContent } from '../../core/services/content.service';
import { ContactUs } from './contact-us';

describe('Contact Us', () => {
  async function render(content: SiteContent) {
    await TestBed.configureTestingModule({
      imports: [ContactUs],
      providers: [provideRouter([]),
        { provide: ContentService, useValue: { getContent: () => of(content) } },
        { provide: AuthService, useValue: { isAuthenticated: () => false, getUser: () => null } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ContactUs);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows saved contacts and hours without publishing an office address', async () => {
    const page = await render({ contact_email: 'help@example.test', contact_phone: '+255 712 345 678', contact_hours: 'Mon–Fri, 09:00–17:00 EAT', contact_address: 'Private office address' });
    expect(page.querySelector('a[href="mailto:help@example.test"]')).toBeTruthy();
    expect(page.querySelector('a[href="tel:+255712345678"]')).toBeTruthy();
    expect(page.textContent).toContain('Mon–Fri, 09:00–17:00 EAT');
    expect(page.textContent).not.toContain('Private office address');
    expect(page.querySelectorAll('h1')).toHaveLength(1);
  });

  it('hides missing contact details and keeps shipment help available', async () => {
    const page = await render({});
    expect(page.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(page.querySelector('a[href^="tel:"]')).toBeNull();
    expect(page.textContent).not.toContain('Support hours');
    expect(page.querySelector('a[href="/account/shipping"]')).toBeTruthy();
    expect(page.querySelector('a[href="/how-it-works"]')).toBeTruthy();
  });
});
