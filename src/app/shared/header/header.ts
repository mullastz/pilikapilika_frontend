import { Component, signal, inject, HostListener } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-header',
  imports: [ RouterLink, CommonModule ],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  isDark = false;
  isLoggedIn = signal(false);
  isProfileDropdownOpen = signal(false);

  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  ngOnInit() {
    const saved = localStorage.getItem('theme');
    this.isDark = saved === 'dark';
    this.checkAuthStatus();
  }

  checkAuthStatus(): void {
    this.isLoggedIn.set(this.authService.isAuthenticated());
  }

  toggleTheme() {
    this.isDark = !this.isDark;

    localStorage.setItem('theme', this.isDark ? 'dark' : 'light');

    this.applyTheme();
  }

  private applyTheme() {
    const html = document.documentElement;

    if (this.isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }

  toggleProfileDropdown(): void {
    this.isProfileDropdownOpen.update(v => !v);
  }

  closeProfileDropdown(): void {
    this.isProfileDropdownOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.isLoggedIn.set(false);
    this.isProfileDropdownOpen.set(false);
    this.toastService.success('Logged out successfully');
    this.router.navigate(['/sign-in']);
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    const dropdown = document.querySelector('.profile-dropdown-container');
    if (dropdown && !dropdown.contains(target)) {
      this.closeProfileDropdown();
    }
  }
}
