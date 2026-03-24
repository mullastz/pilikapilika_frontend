import { Component, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile-management',
  imports: [CommonModule],
  templateUrl: './profile-management.html',
  styleUrl: './profile-management.css',
})
export class ProfileManagement {
  showLogoutModal = signal(false);
  constructor(private location: Location,private router: Router) {}

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
    
    // TODO: Add your actual logout logic here
    console.log('User logged out');

    // Example: Clear token and redirect to login
    // localStorage.removeItem('token');
    // this.router.navigate(['/signin']);
    
    alert('You have been logged out successfully.'); // Remove this in production
  }
}
