import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
import { User, UpdateProfileRequest, UpdateProfileResponse } from '../../core/interfaces/auth.interface';

@Component({
  selector: 'app-manage-account',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './manage-account.html',
  styleUrl: './manage-account.css',
})
export class ManageAccount implements OnInit {
  profileForm: FormGroup;
  user: User | null = null;
  isLoading = false;
  isSaving = false;
  passwordChangeRequested = false;
  isRequestingPasswordChange = false;

  genderOptions = ['Male', 'Female', 'Other'];

  constructor(
    private location: Location,
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService
  ) {
    this.profileForm = this.fb.group({
      firstname: ['', [Validators.required, Validators.maxLength(255)]],
      lastname: ['', [Validators.required, Validators.maxLength(255)]],
      gender: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      phone: ['', Validators.maxLength(20)],
      region: [''],
      district: [''],
      ward: ['', Validators.maxLength(255)],
      address: ['', Validators.maxLength(500)],
    });

  }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    this.isLoading = true;
    this.user = this.authService.getUser();

    if (this.user) {
      this.populateForm(this.user);
    }

    // Always fetch fresh data from server
    this.userService.getProfile().subscribe({
      next: (response: any) => {
        this.user = response.data;
        this.populateForm(response.data);

        // Verify profile completion status from backend (prevents abuse)
        if (response.profile) {
          if (response.profile.is_complete) {
            this.authService.setProfileComplete();
          } else {
            // If backend says incomplete, update local storage
            localStorage.setItem('profile_completion', JSON.stringify({
              is_complete: false,
              missing_fields: response.profile.missing_fields || []
            }));
          }
        }

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading profile:', err);
        this.toastService.error('Failed to load profile. Please try again.');
        this.isLoading = false;
      }
    });
  }

  populateForm(user: User): void {
    this.profileForm.patchValue({
      firstname: user.firstname || '',
      lastname: user.lastname || '',
      gender: user.gender || '',
      email: user.email || '',
      phone: user.phone || '',
      region: user.region || '',
      district: user.district || '',
      ward: user.ward || '',
      address: user.address || '',
    });
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;

    const formValue = this.profileForm.getRawValue();
    const updateData: UpdateProfileRequest = {
      firstname: formValue.firstname,
      lastname: formValue.lastname,
      gender: formValue.gender,
      phone: formValue.phone,
      region: formValue.region,
      district: formValue.district,
      ward: formValue.ward,
      address: formValue.address,
    };

    this.userService.updateProfile(updateData).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.user = response.data;
        // Update profile completion status based on backend response
        if (response.profile?.is_complete) {
          this.authService.setProfileComplete();
        }
        this.toastService.success('Profile updated successfully!');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSaving = false;
        const errorMsg = err.error?.message || 'Failed to update profile. Please try again.';
        this.toastService.error(errorMsg);
        this.cdr.detectChanges();
        console.error('Error updating profile:', err);
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  /**
   * Request password change via secure link
   */
  requestPasswordChange(): void {
    if (!this.user?.email) {
      this.toastService.error('No email found. Please reload your profile.');
      return;
    }

    this.isRequestingPasswordChange = true;
    this.cdr.detectChanges();

    this.authService.forgotPassword(this.user.email).subscribe({
      next: (response) => {
        this.isRequestingPasswordChange = false;
        this.passwordChangeRequested = true;
        this.toastService.success('Password reset email sent! Check your inbox.');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isRequestingPasswordChange = false;
        const errorMsg = err.error?.message || 'Failed to send password reset email. Please try again.';
        this.toastService.error(errorMsg);
        this.cdr.detectChanges();
        console.error('Error requesting password change:', err);
      }
    });
  }

  get firstname() { return this.profileForm.get('firstname'); }
  get lastname() { return this.profileForm.get('lastname'); }
  get gender() { return this.profileForm.get('gender'); }
  get phone() { return this.profileForm.get('phone'); }
  get ward() { return this.profileForm.get('ward'); }
  get address() { return this.profileForm.get('address'); }
}
