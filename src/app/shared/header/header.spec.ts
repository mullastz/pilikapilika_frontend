import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Header } from './header';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([]), { provide: AuthService, useValue: {
        isAuthenticated: () => false, getUser: () => null,
      } }],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/"]')?.textContent).toContain('Pilikapilika');
    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
  });

  it('keeps the public page menu out of the header', () => {
    for (const path of ['/search', '/how-it-works', '/about-us', '/contact-us']) {
      expect(fixture.nativeElement.querySelector(`a[href="${path}"]`)).toBeNull();
    }
    expect(fixture.nativeElement.querySelector('button[aria-controls="public-navigation-mobile"]')).toBeNull();
  });

  it('keeps Help accessible through the account menu', () => {
    component.isLoggedIn.set(true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.profile-dropdown-container button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/account/help"]')?.textContent).toContain('Help');
  });
});
