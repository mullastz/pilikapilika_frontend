import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ChinaToTanzaniaCargo } from './china-to-tanzania-cargo';

describe('China to Tanzania cargo guide', () => {
  it('renders the route guide, shipment questions, and crawlable booking links', async () => {
    await TestBed.configureTestingModule({
      imports: [ChinaToTanzaniaCargo],
      providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated: () => false, getUser: () => null } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChinaToTanzaniaCargo);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelector('h1')?.textContent).toContain('China to Tanzania cargo');
    expect(page.querySelectorAll('details')).toHaveLength(4);
    for (const item of fixture.componentInstance.questions) {
      expect(page.textContent).toContain(item.question);
      expect(page.textContent).toContain(item.answer);
    }
    for (const path of ['/search', '/how-it-works', '/contact-us', '/sign-up']) {
      expect(page.querySelector(`main a[href="${path}"]`)).toBeTruthy();
    }
  });
});
