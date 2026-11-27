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

  it('links Contact Us only, with no quick links or agent search, and no placeholder support details', () => {
    expect(fixture.nativeElement.querySelector('a[href="/contact-us"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Quick Links');
    expect(fixture.nativeElement.querySelector('a[href="/search"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('+255 700 000 000');
    expect(fixture.nativeElement.querySelector('a[href^="mailto:"]')).toBeNull();
  });
});
