import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
import { AddressService, Address, CreateAddressRequest, UpdateAddressRequest } from '../../core/services/address.service';
import { AgentService } from '../../core/services/agent.service';
import { ProfileCompletionService, ProfileAnalysis } from '../../core/services/profile-completion.service';
import { User, UpdateProfileRequest, UpdateProfileResponse } from '../../core/interfaces/auth.interface';
import { ProfileOnboardingWizard } from '../../shared/components/profile-onboarding-wizard/profile-onboarding-wizard';
import { resolveImageUrl } from '../../core/utils/image-url.util';
import { TRANSPORT_CATALOG, transportLabel, transportIcon } from '../../core/utils/transport-methods.util';

@Component({
  selector: 'app-manage-account',
  imports: [CommonModule, ReactiveFormsModule, ProfileOnboardingWizard],
  templateUrl: './manage-account.html',
  styleUrl: './manage-account.css',
})
export class ManageAccount implements OnInit {
  [x: string]: any;
  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  profileForm: FormGroup;
  user: User | null = null;
  isLoading = false;
  isSaving = false;
  passwordChangeRequested = false;
  isRequestingPasswordChange = false;

  // Onboarding wizard state
  profileAnalysis: ProfileAnalysis | null = null;
  showOnboarding = false;
  isFirstTime = false;

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

  // Transport method selection (agents only)
  isAgent = false;
  agentTransportOptions: { value: string; label: string; icon: string }[] = [];
  isTransportDropdownOpen = false;

  readonly transportCatalog = TRANSPORT_CATALOG;

  // Address form
  addressForm: FormGroup;

  readonly FALLBACK_PHOTO = 'assets/landingpage_images/profile1.webp';

  genderOptions = ['Male', 'Female', 'Other'];

  countryOptions = [
    'Tanzania',
    'Kenya',
    'Uganda',
    'Rwanda',
    'Burundi',
    'Democratic Republic of Congo',
    'Zambia',
    'Malawi',
    'Mozambique',
    'South Sudan',
  ];

  constructor(
    private location: Location,
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private addressService: AddressService,
    private agentService: AgentService,
    private profileCompletionService: ProfileCompletionService,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    private route: ActivatedRoute,
  ) {
    this.profileForm = this.fb.group({
      firstname: ['', [Validators.required, Validators.maxLength(255)]],
      lastname: ['', [Validators.required, Validators.maxLength(255)]],
      gender: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      phone: ['', Validators.maxLength(20)],
      region: [''],
      district: [''],
      country: [''],
      ward: ['', Validators.maxLength(255)],
      address: ['', Validators.maxLength(500)],
    });

    this.addressForm = this.fb.group({
      label: [''],
      address_line: ['', [Validators.required, Validators.maxLength(500)]],
      transport_method: [''],
      is_default: [false],
    });
  }

  ngOnInit(): void {
    this.loadUserProfile();
    this.loadAddresses();
    this.checkForOnboarding();
    this.loadAgentTransportMethods();
  }

  /**
   * Agents tag each physical address with one of the transport methods
   * they offer on their agent profile.
   */
  loadAgentTransportMethods(): void {
    const user = this.authService.getUser();
    this.isAgent = user?.role === 'Seller' || user?.role === 'seller';
    if (!this.isAgent || !user?.id) return;

    this.agentService.getAgentProfile(user.id).subscribe({
      next: (agent) => {
        const offered = agent.transport_methods || [];
        this.agentTransportOptions = this.transportCatalog.filter(o => offered.includes(o.value));
        // Gracefully include values not present in the catalog
        offered.filter(v => !this.transportCatalog.some(o => o.value === v))
          .forEach(v => this.agentTransportOptions.push({ value: v, label: v, icon: 'fa-solid fa-truck-fast' }));
        this.cdr.detectChanges();
      },
      error: () => {
        // Not critical — dropdown just stays hidden
      }
    });
  }

  get selectedTransportOption(): { value: string; label: string; icon: string } | null {
    const value = this.addressForm.get('transport_method')?.value;
    return this.agentTransportOptions.find(o => o.value === value) || null;
  }

  toggleTransportDropdown(): void {
    this.isTransportDropdownOpen = !this.isTransportDropdownOpen;
  }

  selectTransportMethod(value: string): void {
    this.addressForm.patchValue({ transport_method: value });
    this.isTransportDropdownOpen = false;
  }

  transportLabel(value: string | null | undefined): string {
    return transportLabel(value);
  }

  transportIcon(value: string | null | undefined): string {
    return transportIcon(value);
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
      country: user.country || '',
      ward: user.ward || '',
      address: user.address || '',
    });
  }

  // ── Onboarding Wizard ────────────────────────────────────────────

  /**
   * Check if user was redirected here for profile completion
   * and show the onboarding wizard
   */
  checkForOnboarding(): void {
    // Check URL query param for incomplete profile redirect
    const reason = this.route.snapshot.queryParamMap.get('reason');
    const isIncomplete = this.authService.needsProfileCompletion();

    if (reason === 'incomplete_profile' || isIncomplete) {
      this.isFirstTime = reason === 'incomplete_profile';

      // Build profile analysis for the wizard
      const user = this.authService.getUser();
      if (user) {
        this.profileAnalysis = this.profileCompletionService.analyzeProfile(user, null);

        // Show onboarding after a short delay for the page to settle
        setTimeout(() => {
          this.showOnboarding = true;
          this.cdr.detectChanges();
        }, 600);
      }
    }
  }

  /**
   * Handle wizard profile update — refresh data from backend
   */
  onProfileUpdated(): void {
    // Refresh user profile data
    this.loadUserProfile();
    this.showOnboarding = false;
  }

  /**
   * Handle wizard completion — redirect to home
   */
  onWizardComplete(): void {
    // The wizard itself redirects to /home after a successful save.
    // Parent just needs to close the modal.
    this.showOnboarding = false;
  }

  onWizardClose(): void {
    this.showOnboarding = false;
  }

  // ── Photo handling ──────────────────────────────────────────────

  get currentPhotoSrc(): string {
    // Priority: local preview > server photo > fallback
    return this.photoPreview ?? resolveImageUrl(this.user?.profile_photo, this.FALLBACK_PHOTO);
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
      country: formValue.country,
      ward: formValue.ward,
      address: formValue.address,
    };

    this.userService.updateProfile(updateData).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.user = response.data;
        if (response.profile?.is_complete) {
          this.authService.setProfileComplete();
        } else if (response.profile) {
          // Update profile completion status with missing fields
          localStorage.setItem('profile_completion', JSON.stringify({
            is_complete: false,
            missing_fields: response.profile.missing_fields || []
          }));
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
    this.isTransportDropdownOpen = false;
    this.addressForm.reset({
      label: '',
      address_line: '',
      transport_method: '',
      is_default: false,
    });
    this.showAddressForm = true;
  }

  editAddress(address: Address): void {
    this.isEditingAddress = true;
    this.editingAddressId = address.id;
    this.isTransportDropdownOpen = false;
    this.addressForm.patchValue({
      label: address.label || '',
      address_line: address.address_line,
      transport_method: address.transport_method || '',
      is_default: address.is_default,
    });
    this.showAddressForm = true;
  }

  cancelAddressForm(): void {
    this.showAddressForm = false;
    this.isEditingAddress = false;
    this.editingAddressId = null;
    this.isTransportDropdownOpen = false;
    this.addressForm.reset();
  }

  saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }

    this.isSavingAddress = true;
    const formValue = this.addressForm.getRawValue();

    // Only agents tag addresses with a transport method
    const transportMethod = this.isAgent ? (formValue.transport_method || null) : null;

    if (this.isAgent && !transportMethod) {
      this.addressForm.get('transport_method')?.markAsTouched();
      this.toastService.error('Please select the transport method for this address.');
      return;
    }

    if (this.isEditingAddress && this.editingAddressId) {
      // Update existing address
      const updateData: UpdateAddressRequest = {
        label: formValue.label || undefined,
        address_line: formValue.address_line,
        transport_method: transportMethod,
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
        transport_method: transportMethod,
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

  // ── Profile Completion Helpers ───────────────────────────────────

  /**
   * Check if user needs to complete their BASIC profile
   * (Only checks essential fields, not agent-specific ones)
   */
  needsProfileCompletion(): boolean {
    const user = this.authService.getUser();
    if (!user) return false;

    const basicFields = ['firstname', 'lastname', 'phone', 'region', 'district'];
    return basicFields.some(field => {
      const value = (user as any)[field];
      return !value || value === '' || value === null;
    });
  }
}
