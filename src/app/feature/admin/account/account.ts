import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { User, UpdateProfileRequest } from '../../../core/interfaces/auth.interface';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './account.html',
})
export class AdminAccount implements OnInit {
  user = signal<User | null>(null);
  loading = signal(true);
  savingProfile = signal(false);
  savingPassword = signal(false);

  activeTab = signal<'profile' | 'security'>('profile');

  profileData = signal({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    gender: undefined as "Male" | "Female" | "Other" | undefined,
    region: '',
    district: '',
    ward: '',
    address: '',
  });

  passwordData = signal({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadUser();
  }

  loadUser(): void {
    this.loading.set(true);
    const u = this.authService.getUser();
    if (u) {
      this.user.set(u);
      this.profileData.set({
        firstname: u.firstname || '',
        lastname: u.lastname || '',
        email: u.email || '',
        phone: u.phone || '',
        gender: (u.gender as "Male" | "Female" | "Other" | undefined) || undefined,
        region: u.region || '',
        district: u.district || '',
        ward: u.ward || '',
        address: u.address || '',
      });
    }
    this.loading.set(false);
  }

  saveProfile(): void {
    this.savingProfile.set(true);
    this.userService.updateProfile(this.profileData()).subscribe({
      next: (res) => {
        this.authService.saveUser(res.data);
        this.user.set(res.data);
        this.toastService.success('Profile updated successfully');
        this.savingProfile.set(false);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to update profile';
        this.toastService.error(msg);
        this.savingProfile.set(false);
      },
    });
  }

  changePassword(): void {
    const { current_password, new_password, new_password_confirmation } = this.passwordData();

    if (!current_password || !new_password) {
      this.toastService.error('Please fill in all password fields');
      return;
    }
    if (new_password !== new_password_confirmation) {
      this.toastService.error('New password and confirmation do not match');
      return;
    }
    if (new_password.length < 8) {
      this.toastService.error('New password must be at least 8 characters');
      return;
    }

    this.savingPassword.set(true);
    this.userService.changePassword({ current_password, new_password, new_password_confirmation }).subscribe({
      next: () => {
        this.toastService.success('Password changed successfully');
        this.passwordData.set({ current_password: '', new_password: '', new_password_confirmation: '' });
        this.savingPassword.set(false);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to change password';
        this.toastService.error(msg);
        this.savingPassword.set(false);
      },
    });
  }
}
