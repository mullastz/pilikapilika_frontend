import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
import { AddressService, Address, CreateAddressRequest, UpdateAddressRequest } from '../../core/services/address.service';
import { User, UpdateProfileRequest, UpdateProfileResponse } from '../../core/interfaces/auth.interface';

@Component({
  selector: 'app-manage-account',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './manage-account.html',
  styleUrl: './manage-account.css',
})
export class ManageAccount implements OnInit {
  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  profileForm: FormGroup;
  user: User | null = null;
  isLoading = false;
  isSaving = false;
  passwordChangeRequested = false;
  isRequestingPasswordChange = false;

  // Photo upload state
  photoPreview: string | null = null;
  selectedPhotoFile: File | null = null;
  isUploadingPhoto = false;

  // Addresses state
  addresses: Address[] = [];
  isLoadingAddresses = false;
  isSavingAddress = false;
  isEditingAddress = false;
  editingAddressId: number | null = null;
  showAddressForm = false;

  // Address form
  addressForm: FormGroup;

  readonly FALLBACK_PHOTO = 'assets/landingpage_images/profile1.webp';

  genderOptions = ['Male', 'Female', 'Other'];

  constructor(
    private location: Location,
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private addressService: AddressService,
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

    this.addressForm = this.fb.group({
      label: [''],
      address_line: ['', [Validators.required, Validators.maxLength(500)]],
      is_default: [false],
    });
  }

  ngOnInit(): void {
    this.loadUserProfile();
    this.loadAddresses();
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

  // ── Photo handling ──────────────────────────────────────────────

  get currentPhotoSrc(): string {
    // Priority: local preview > server photo > fallback
    return this.photoPreview ?? this.user?.profile_photo ?? this.FALLBACK_PHOTO;
  }

  triggerPhotoInput(): void {
    this.photoInput.nativeElement.click();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate type
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.toastService.error('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }

    // Validate size (2 MB)
    if (file.size > 2 * 1024 * 1024) {
      this.toastService.error('Image must be smaller than 2 MB.');
      return;
    }

    this.selectedPhotoFile = file;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  uploadPhoto(): void {
    if (!this.selectedPhotoFile) return;

    this.isUploadingPhoto = true;
    this.cdr.detectChanges();

    this.userService.uploadProfilePhoto(this.selectedPhotoFile).subscribe({
      next: (response) => {
        this.isUploadingPhoto = false;
        this.user = response.data;
        // Clear the local preview — the server URL is now in user.profile_photo
        this.photoPreview = null;
        this.selectedPhotoFile = null;
        // Reset file input so the same file can be re-selected if needed
        if (this.photoInput?.nativeElement) {
          this.photoInput.nativeElement.value = '';
        }
        // Persist updated user to local storage
        this.authService.saveUser(response.data);
        this.toastService.success('Profile photo updated!');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isUploadingPhoto = false;
        const msg = err.error?.message || 'Failed to upload photo. Please try again.';
        this.toastService.error(msg);
        this.cdr.detectChanges();
        console.error('Photo upload error:', err);
      }
    });
  }

  cancelPhotoSelection(): void {
    this.photoPreview = null;
    this.selectedPhotoFile = null;
    if (this.photoInput?.nativeElement) {
      this.photoInput.nativeElement.value = '';
    }
    this.cdr.detectChanges();
  }

  // ── Form submit ─────────────────────────────────────────────────

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

  requestPasswordChange(): void {
    if (!this.user?.email) {
      this.toastService.error('No email found. Please reload your profile.');
      return;
    }

    this.isRequestingPasswordChange = true;
    this.cdr.detectChanges();

    this.authService.forgotPassword(this.user.email).subscribe({
      next: () => {
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

  // ── Address Management ───────────────────────────────────────────

  loadAddresses(): void {
    this.isLoadingAddresses = true;
    this.addressService.getAddresses().subscribe({
      next: (response) => {
        this.addresses = response.data || [];
        this.isLoadingAddresses = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading addresses:', err);
        this.toastService.error('Failed to load addresses. Please try again.');
        this.isLoadingAddresses = false;
      }
    });
  }

  showAddAddressForm(): void {
    this.isEditingAddress = false;
    this.editingAddressId = null;
    this.addressForm.reset({
      label: '',
      address_line: '',
      is_default: false,
    });
    this.showAddressForm = true;
  }

  editAddress(address: Address): void {
    this.isEditingAddress = true;
    this.editingAddressId = address.id;
    this.addressForm.patchValue({
      label: address.label || '',
      address_line: address.address_line,
      is_default: address.is_default,
    });
    this.showAddressForm = true;
  }

  cancelAddressForm(): void {
    this.showAddressForm = false;
    this.isEditingAddress = false;
    this.editingAddressId = null;
    this.addressForm.reset();
  }

  saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }

    this.isSavingAddress = true;
    const formValue = this.addressForm.getRawValue();

    if (this.isEditingAddress && this.editingAddressId) {
      // Update existing address
      const updateData: UpdateAddressRequest = {
        label: formValue.label || undefined,
        address_line: formValue.address_line,
        is_default: formValue.is_default,
      };

      this.addressService.updateAddress(this.editingAddressId, updateData).subscribe({
        next: (response) => {
          this.isSavingAddress = false;
          this.toastService.success('Address updated successfully!');
          this.loadAddresses();
          this.cancelAddressForm();
        },
        error: (err: any) => {
          this.isSavingAddress = false;
          const errorMsg = err.error?.message || 'Failed to update address. Please try again.';
          this.toastService.error(errorMsg);
        }
      });
    } else {
      // Create new address
      const createData: CreateAddressRequest = {
        label: formValue.label || undefined,
        address_line: formValue.address_line,
        is_default: formValue.is_default,
      };

      this.addressService.createAddress(createData).subscribe({
        next: (response) => {
          this.isSavingAddress = false;
          this.toastService.success('Address added successfully!');
          this.loadAddresses();
          this.cancelAddressForm();
        },
        error: (err: any) => {
          this.isSavingAddress = false;
          const errorMsg = err.error?.message || 'Failed to add address. Please try again.';
          this.toastService.error(errorMsg);
        }
      });
    }
  }

  deleteAddress(id: number): void {
    if (!confirm('Are you sure you want to delete this address?')) {
      return;
    }

    this.addressService.deleteAddress(id).subscribe({
      next: (response) => {
        this.toastService.success('Address deleted successfully!');
        this.loadAddresses();
      },
      error: (err: any) => {
        const errorMsg = err.error?.message || 'Failed to delete address. Please try again.';
        this.toastService.error(errorMsg);
      }
    });
  }

  setDefaultAddress(id: number): void {
    this.addressService.setDefaultAddress(id).subscribe({
      next: (response) => {
        this.toastService.success('Default address updated successfully!');
        this.loadAddresses();
      },
      error: (err: any) => {
        const errorMsg = err.error?.message || 'Failed to set default address. Please try again.';
        this.toastService.error(errorMsg);
      }
    });
  }

  // ── Form Getters ─────────────────────────────────────────────────────

  get firstname() { return this.profileForm.get('firstname'); }
  get lastname() { return this.profileForm.get('lastname'); }
  get gender() { return this.profileForm.get('gender'); }
  get phone() { return this.profileForm.get('phone'); }
  get ward() { return this.profileForm.get('ward'); }
  get address() { return this.profileForm.get('address'); }

  get addressLine() { return this.addressForm.get('address_line'); }
}
