import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { User, Region, District, UpdateProfileRequest } from '../../core/interfaces/auth.interface';

@Component({
  selector: 'app-manage-account',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './manage-account.html',
  styleUrl: './manage-account.css',
})
export class ManageAccount implements OnInit {
  profileForm: FormGroup;
  passwordForm: FormGroup;
  user: User | null = null;
  regions: Region[] = [];
  districts: District[] = [];
  filteredDistricts: District[] = [];
  isLoading = false;
  isSaving = false;
  isChangingPassword = false;
  showPasswordForm = false;

  genderOptions = ['Male', 'Female', 'Other'];

  constructor(
    private location: Location,
    private fb: FormBuilder,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService
  ) {
    this.profileForm = this.fb.group({
      firstname: ['', [Validators.required, Validators.maxLength(255)]],
      lastname: ['', [Validators.required, Validators.maxLength(255)]],
      gender: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      phone: ['', Validators.maxLength(20)],
      region_id: [null],
      district_id: [null],
      ward: ['', Validators.maxLength(255)],
      address: ['', Validators.maxLength(500)],
    });

    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required, Validators.minLength(6)]],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      new_password_confirmation: ['', [Validators.required, Validators.minLength(6)]],
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.loadRegions();
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    this.isLoading = true;
    this.user = this.authService.getUser();

    if (this.user) {
      this.populateForm(this.user);
      if (this.user.region_id) {
        this.loadDistrictsByRegion(this.user.region_id);
      }
    }

    // Always fetch fresh data from server
    this.authService.getProfile().subscribe({
      next: (user) => {
        this.user = user;
        this.populateForm(user);
        if (user.region_id) {
          this.loadDistrictsByRegion(user.region_id);
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading profile:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  populateForm(user: User): void {
    this.profileForm.patchValue({
      firstname: user.firstname,
      lastname: user.lastname,
      gender: user.gender,
      email: user.email,
      phone: user.phone || '',
      region_id: user.region_id,
      district_id: user.district_id,
      ward: user.ward || '',
      address: user.address || '',
    });
  }

  loadRegions(): void {
    this.authService.getRegions().subscribe({
      next: (regions) => {
        this.regions = regions;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading regions:', err);
      }
    });
  }

  loadDistrictsByRegion(regionId: number): void {
    this.authService.getDistrictsByRegion(regionId).subscribe({
      next: (districts) => {
        this.filteredDistricts = districts;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading districts:', err);
      }
    });
  }

  onRegionChange(): void {
    const regionId = this.profileForm.get('region_id')?.value;
    if (regionId) {
      this.profileForm.patchValue({ district_id: null });
      this.loadDistrictsByRegion(regionId);
    } else {
      this.filteredDistricts = [];
      this.profileForm.patchValue({ district_id: null });
    }
    this.cdr.detectChanges();
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
      phone: formValue.phone || null,
      region_id: formValue.region_id || null,
      district_id: formValue.district_id || null,
      ward: formValue.ward || null,
      address: formValue.address || null,
    };

    this.authService.updateProfile(updateData).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.user = response.data;
        this.toastService.success('Profile updated successfully!');
        this.cdr.detectChanges();
      },
      error: (err) => {
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

  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;
    if (!this.showPasswordForm) {
      this.passwordForm.reset();
    }
    this.cdr.detectChanges();
  }

  passwordMatchValidator(form: FormGroup): { [key: string]: boolean } | null {
    const password = form.get('new_password')?.value;
    const confirmPassword = form.get('new_password_confirmation')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  onChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isChangingPassword = true;

    const formValue = this.passwordForm.value;
    this.authService.changePassword({
      current_password: formValue.current_password,
      new_password: formValue.new_password,
      new_password_confirmation: formValue.new_password_confirmation,
    }).subscribe({
      next: (response) => {
        this.isChangingPassword = false;
        this.passwordForm.reset();
        this.showPasswordForm = false;
        this.toastService.success(response.message || 'Password changed successfully!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isChangingPassword = false;
        const errorMsg = err.error?.message || 'Failed to change password. Please try again.';
        this.toastService.error(errorMsg);
        this.cdr.detectChanges();
        console.error('Error changing password:', err);
      }
    });
  }

  get firstname() { return this.profileForm.get('firstname'); }
  get lastname() { return this.profileForm.get('lastname'); }
  get gender() { return this.profileForm.get('gender'); }
  get phone() { return this.profileForm.get('phone'); }
  get ward() { return this.profileForm.get('ward'); }
  get address() { return this.profileForm.get('address'); }

  get currentPassword() { return this.passwordForm.get('current_password'); }
  get newPassword() { return this.passwordForm.get('new_password'); }
  get confirmPassword() { return this.passwordForm.get('new_password_confirmation'); }
}
