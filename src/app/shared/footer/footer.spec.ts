import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Footer } from './footer';
import { provideRouter } from '@angular/router';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links the public pages without placeholder support details', () => {
    for (const path of ['/search', '/how-it-works', '/about-us', '/contact-us', '/china-to-tanzania-cargo']) {
      expect(fixture.nativeElement.querySelector(`a[href="${path}"]`)).toBeTruthy();
    }
    expect(fixture.nativeElement.textContent).not.toContain('+255 700 000 000');
    expect(fixture.nativeElement.querySelector('a[href^="mailto:"]')).toBeNull();
  });
});
