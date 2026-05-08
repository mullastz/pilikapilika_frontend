import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', route: '/admin/dashboard', icon: 'fa-solid fa-chart-pie' },
  { label: 'Users', route: '/admin/users', icon: 'fa-solid fa-users' },
  { label: 'Agents', route: '/admin/agents', icon: 'fa-solid fa-truck-fast' },
  { label: 'Shipments', route: '/admin/shipments', icon: 'fa-solid fa-box' },
  { label: 'QR Codes', route: '/admin/qr-codes', icon: 'fa-solid fa-qrcode' },
  { label: 'Regions', route: '/admin/regions', icon: 'fa-solid fa-map-location-dot' },
  { label: 'Messages', route: '/admin/messages', icon: 'fa-solid fa-comments' },
  { label: 'Logs', route: '/admin/logs', icon: 'fa-solid fa-clock-rotate-left' },
  { label: 'Settings', route: '/admin/settings', icon: 'fa-solid fa-gear' },
  { label: 'My Account', route: '/admin/account', icon: 'fa-solid fa-user-shield' },
];

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class AdminLayout implements OnInit {
  navItems = NAV_ITEMS;
  sidebarOpen = signal(false);
  mobileMenuOpen = signal(false);
  currentUser: ReturnType<AuthService['getUser']> | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getUser();
    this.sidebarOpen.set(window.innerWidth >= 1024);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  isActive(route: string): boolean {
    return this.router.url === route || this.router.url.startsWith(route + '/');
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/sign-in']);
  }
}
