import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/interfaces/auth.interface';

@Component({
  selector: 'app-profile-management',
  imports: [CommonModule],
  templateUrl: './profile-management.html',
  styleUrl: './profile-management.css',
})
export class ProfileManagement implements OnInit {
  showLogoutModal = signal(false);
  user: User | null = null;
  isAgent = false;

  constructor(
    private location: Location,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadUser();
  }

  loadUser(): void {
    this.user = this.authService.getUser();
    // Backend uses 'Seller' for agents and 'Buyer' for clients
    this.isAgent = this.user?.role === 'Seller' || this.user?.role === 'seller';
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      // fallback route (example: home)
      // inject Router if needed
    }
  }

  goTo(page: string) {
    this.router.navigate([`/account/${page}`]);
  }

  openLogoutModal() {
    this.showLogoutModal.set(true);
  }

  cancelLogout() {
    this.showLogoutModal.set(false);
  }

  confirmLogout() {
    this.showLogoutModal.set(false);
    
    // Clear auth data
    this.authService.logout();
    
    // Show success toast
    this.toastService.success('You have been logged out successfully');
    
    // Redirect to login
    this.router.navigate(['/sign-in']);
  }
}
