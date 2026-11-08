import { Component, signal, inject, input, output, HostListener, afterNextRender, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/interfaces/auth.interface';
import { resolveImageUrl } from '../../core/utils/image-url.util';

@Component({
  selector: 'app-header',
  imports: [ RouterLink, CommonModule ],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  readonly appearance = input<'hero' | 'page'>('hero');
  readonly passwordChangeRequested = output<void>();
  readonly isStaff = signal(false);
  readonly currentUser = signal<User | null>(null);
  readonly fallbackPhoto = 'assets/landingpage_images/defaultprofile.jfif';
  isDark = false;
  isLoggedIn = signal(false);
  isProfileDropdownOpen = signal(false);
  isAgent = signal(false);

  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    afterNextRender(() => {
      this.isDark = localStorage.getItem('theme') === 'dark';
      this.checkAuthStatus();
      this.cdr.markForCheck();
    });
  }

  checkAuthStatus(): void {
    this.isLoggedIn.set(this.authService.isAuthenticated());
    const user = this.authService.getUser();
    this.currentUser.set(user);
    this.isStaff.set(!!user?.is_agency_staff);
    const role = user?.role?.toLowerCase();
    this.isAgent.set(role === 'agent' || role === 'seller');
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

  requestPasswordChange(): void {
    this.closeProfileDropdown();
    this.passwordChangeRequested.emit();
  }

  get profilePhoto(): string {
    return resolveImageUrl(this.currentUser()?.profile_photo, this.fallbackPhoto);
  }

  onPhotoError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(this.fallbackPhoto)) image.src = this.fallbackPhoto;
  }

  @HostListener('document:keydown.escape')
  closeMenus(): void {
    this.closeProfileDropdown();
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
