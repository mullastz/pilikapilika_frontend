import { Component, HostListener, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { filter, Subscription } from 'rxjs';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-menu-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './menu-bar.html',
  styleUrl: './menu-bar.css'
})
export class MenuBar implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);

  isVisible = signal(true);
  isLoggedIn = signal(false);
  currentRoute = signal('');
  lastScrollY = signal(0);
  scrollThreshold = 10;

  private routerSubscription!: Subscription;

  readonly menuItems: MenuItem[] = [
    { label: 'Home', icon: 'fa-solid fa-house', route: '/home' },
    { label: 'Shipping', icon: 'fa-solid fa-box', route: '/account/shipping' },
    { label: 'Search', icon: 'fa-solid fa-magnifying-glass', route: '/search' },
    { label: 'Message', icon: 'fa-solid fa-message', route: '/messages' },
    { label: 'Profile', icon: 'fa-solid fa-user', route: '/profile-management' }
  ];

  private readonly hiddenRoutes = [
    '/search',
    '/agent/',
    '/qr-generator',
    '/sign-in',
    '/sign-up',
    '/account/details',
    '/account/history',
    '/account/help',
    '/forgot-password',
    '/reset-password',
    '/verify-email'
  ];

  ngOnInit(): void {
    this.checkAuthStatus();
    this.updateCurrentRoute(this.router.url);

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateCurrentRoute(event.urlAfterRedirects);
        this.checkAuthStatus();
      });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  checkAuthStatus(): void {
    this.isLoggedIn.set(this.authService.isAuthenticated());
  }

  updateCurrentRoute(url: string): void {
    this.currentRoute.set(url);
  }

  shouldShowMenuBar(): boolean {
    if (!this.isLoggedIn()) {
      return false;
    }

    const currentRoute = this.currentRoute();
    return !this.hiddenRoutes.some(route => {
      if (route.endsWith('/')) {
        return currentRoute.startsWith(route);
      }
      return currentRoute === route || currentRoute.startsWith(route + '/');
    });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const currentScrollY = window.scrollY;
    const previousScrollY = this.lastScrollY();

    if (currentScrollY < previousScrollY) {
      this.isVisible.set(true);
    } else if (currentScrollY > previousScrollY && currentScrollY > this.scrollThreshold) {
      this.isVisible.set(false);
    }

    this.lastScrollY.set(currentScrollY);
  }

  isActive(route: string): boolean {
    const current = this.currentRoute();
    if (route === '/') {
      return current === '/' || current === '';
    }
    return current === route || current.startsWith(route + '/');
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
