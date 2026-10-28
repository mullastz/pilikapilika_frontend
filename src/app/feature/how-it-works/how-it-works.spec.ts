import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { HowItWorks } from './how-it-works';

describe('How It Works', () => {
  it('explains the five shipment steps and links discovery and support', async () => {
    await TestBed.configureTestingModule({
      imports: [HowItWorks],
      providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated: () => false, getUser: () => null } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(HowItWorks);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelectorAll('article')).toHaveLength(5);
    for (const step of fixture.componentInstance.steps) expect(page.textContent).toContain(step.title);
    expect(page.querySelector('main a[href="/search"]')).toBeTruthy();
    expect(page.querySelector('main a[href="/contact-us"]')).toBeTruthy();
  });
});
