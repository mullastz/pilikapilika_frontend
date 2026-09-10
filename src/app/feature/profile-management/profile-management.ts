import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/interfaces/auth.interface';
import { resolveImageUrl } from '../../core/utils/image-url.util';

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
  readonly fallbackPhoto = 'assets/landingpage_images/profile1.webp';

  get profilePhotoSrc(): string {
    return resolveImageUrl(this.user?.profile_photo, this.fallbackPhoto);
  }
  
  tabs = [
    {
      id: 'details',
      title: 'Manage Account',
      icon: 'fa-user-gear',
      bgColor: 'bg-orange-200',
      darkBgColor: 'dark:bg-[#111]',
      iconBgColor: 'bg-orange-500'
    },
    {
      id: 'agent',
      title: 'Agent Profile',
      icon: 'fa-id-card',
      bgColor: 'bg-orange-200',
      darkBgColor: 'dark:bg-[#111]',
      iconBgColor: 'bg-orange-500',
      agentOnly: true
    },
    {
      id: 'scan-qr',
      title: 'Scan QR',
      icon: 'fa-camera',
      bgColor: 'bg-orange-200',
      darkBgColor: 'dark:bg-[#111]',
      iconBgColor: 'bg-orange-500',
      agentOnly: true
    },
    {
      id: 'my-products',
      title: 'My Parcels',
      icon: 'fa-box',
      bgColor: 'bg-orange-200',
      darkBgColor: 'dark:bg-[#111]',
      iconBgColor: 'bg-orange-500'
    },
    {
      id: 'shipping',
      title: 'Shipments',
      icon: 'fa-truck-fast',
      bgColor: 'bg-orange-200',
      darkBgColor: 'dark:bg-[#111]',
      iconBgColor: 'bg-orange-500'
    },
    {
      id: 'help',
      title: 'Help Center',
      icon: 'fa-circle-question',
      bgColor: 'bg-orange-200',
      darkBgColor: 'dark:bg-[#111]',
      iconBgColor: 'bg-orange-500'
    }
  ];

  constructor(
    private location: Location,
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadUser();
  }

  loadUser(): void {
    this.user = this.authService.getUser();
    // Backend uses 'Seller' for agents and 'Buyer' for clients
    this.isAgent = this.user?.role === 'Seller' || this.user?.role === 'seller';

    // Refresh from server so a recently uploaded photo shows up
    this.userService.getProfile().subscribe({
      next: (response: any) => {
        this.user = response.data;
        this.authService.saveUser(response.data);
      },
      error: () => {
        // Keep cached user on failure
      }
    });
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
