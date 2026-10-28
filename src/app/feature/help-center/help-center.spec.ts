import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpCenter } from './help-center';
import { provideRouter } from '@angular/router';

describe('HelpCenter', () => {
  let component: HelpCenter;
  let fixture: ComponentFixture<HelpCenter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpCenter],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpCenter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links all four public pages above the existing FAQs', () => {
    const page = fixture.nativeElement as HTMLElement;
    const navigation = page.querySelector('nav[aria-label="Pilikapilika pages"]');
    for (const [path, label] of [
      ['/search', 'Search Agents'], ['/how-it-works', 'How It Works'],
      ['/about-us', 'About Us'], ['/contact-us', 'Contact Us'],
    ]) {
      expect(navigation?.querySelector(`a[href="${path}"]`)?.textContent).toContain(label);
    }
    expect(page.textContent).toContain('Frequently Asked Questions');
  });
});
