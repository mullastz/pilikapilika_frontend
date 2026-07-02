import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProfileCompletionService, ProfileAnalysis } from '../../../core/services/profile-completion.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { User, UpdateProfileRequest } from '../../../core/interfaces/auth.interface';

/**
 * WizardStep - A grouped step containing multiple related fields
 */
export interface WizardStep {
  stepNumber: number;
  title: string;
  subtitle: string;
  icon: string;
  fields: WizardField[];
}

/**
 * Individual field within a step
 */
export interface WizardField {
  name: string;
  label: string;
  placeholder: string;
  inputType: 'text' | 'tel' | 'select' | 'textarea';
  options?: string[];
  required: boolean;
  tip: string;
  example: string;
}

/**
 * ProfileOnboardingWizard - Quick 3-step profile completion
 *
 * Step 1: Personal Info (firstname, lastname, gender)
 * Step 2: Contact & Location (phone, country, region)
 * Step 3: Address (district, ward, address)
 *
 * Only collects essential info. Agent-specific fields (pricing, bio, etc.)
 * are left for the agent to fill later in their own time.
 */
@Component({
  selector: 'app-profile-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-onboarding-wizard.html',
  styleUrl: './profile-onboarding-wizard.css'
})
export class ProfileOnboardingWizard implements OnInit {
  @Input() analysis: ProfileAnalysis | null = null;
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() complete = new EventEmitter<void>();
  @Output() profileUpdated = new EventEmitter<void>();

  private router = inject(Router);
  private profileService = inject(ProfileCompletionService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private toastService = inject(ToastService);

  // Wizard state
  currentStepIndex = 0;
  showWelcome = true;
  showCompletion = false;
  isSaving = false;

  // Field values entered by user
  fieldValues: Record<string, string> = {};

  // Validation state
  fieldErrors: Record<string, string> = {};
  fieldTouched: Record<string, boolean> = {};

  // User data
  userName = '';
  userRole: 'customer' | 'agent' = 'customer';

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (user) {
      this.userName = user.firstname || user.username || 'there';
      this.userRole = this.profileService.getRole(user);
      this.prefillFromUser(user);
    }
  }

  get isVisible(): boolean {
    return this.show && !!this.analysis && !this.analysis.isComplete;
  }

  get steps(): WizardStep[] {
    return this.buildSteps();
  }

  get currentStep(): WizardStep | null {
    if (this.showWelcome || this.showCompletion) return null;
    return this.steps[this.currentStepIndex] || null;
  }

  get totalSteps(): number {
    return this.steps.length;
  }

  get isLastStep(): boolean {
    return this.currentStepIndex === this.totalSteps - 1;
  }

  get canGoBack(): boolean {
    return this.currentStepIndex > 0;
  }

  /**
   * Build the 3 quick steps based on what's actually missing
   */
  private buildSteps(): WizardStep[] {
    const missingFields = this.analysis?.missingFields.map(f => f.field) || [];
    const steps: WizardStep[] = [];

    // Step 1: Personal Info (firstname, lastname, gender)
    const step1Fields: WizardField[] = [];
    if (missingFields.includes('firstname')) {
      step1Fields.push({
        name: 'firstname', label: 'First Name', placeholder: 'Enter your first name',
        inputType: 'text', required: true,
        tip: 'This is how others will address you on the platform.',
        example: 'e.g., John, Grace, Michael'
      });
    }
    if (missingFields.includes('lastname')) {
      step1Fields.push({
        name: 'lastname', label: 'Last Name', placeholder: 'Enter your last name',
        inputType: 'text', required: true,
        tip: 'Your family name appears on shipping labels and documents.',
        example: 'e.g., Mwakalinga, Nyerere, Smith'
      });
    }
    if (missingFields.includes('gender')) {
      step1Fields.push({
        name: 'gender', label: 'Gender', placeholder: 'Select your gender',
        inputType: 'select', options: ['Male', 'Female', 'Other'], required: true,
        tip: 'Helps us personalize your experience.',
        example: ''
      });
    }
    if (step1Fields.length > 0) {
      steps.push({
        stepNumber: 1,
        title: 'Who Are You?',
        subtitle: 'Let us know your name so we can personalize your experience.',
        icon: 'fa-solid fa-user',
        fields: step1Fields
      });
    }

    // Step 2: Contact & Location (phone, country, region)
    const step2Fields: WizardField[] = [];
    if (missingFields.includes('phone')) {
      step2Fields.push({
        name: 'phone', label: 'Phone Number', placeholder: 'Enter your phone number',
        inputType: 'tel', required: true,
        tip: 'Agents will use this to contact you about pickups and deliveries.',
        example: 'e.g., 0712 345 678'
      });
    }
    if (missingFields.includes('country')) {
      step2Fields.push({
        name: 'country', label: 'Country', placeholder: 'Select your country',
        inputType: 'select', options: ['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Burundi'], required: true,
        tip: 'Helps us show you relevant agents and services.',
        example: ''
      });
    }
    if (missingFields.includes('region')) {
      step2Fields.push({
        name: 'region', label: 'Region', placeholder: 'Enter your region',
        inputType: 'text', required: true,
        tip: 'This helps us match you with nearby agents.',
        example: 'e.g., Dar es Salaam, Arusha, Mwanza'
      });
    }
    if (step2Fields.length > 0) {
      steps.push({
        stepNumber: 2,
        title: 'How Can We Reach You?',
        subtitle: 'Your contact details help agents coordinate deliveries smoothly.',
        icon: 'fa-solid fa-phone',
        fields: step2Fields
      });
    }

    // Step 3: Address Details (district, ward, address)
    const step3Fields: WizardField[] = [];
    if (missingFields.includes('district')) {
      step3Fields.push({
        name: 'district', label: 'District', placeholder: 'Enter your district',
        inputType: 'text', required: true,
        tip: 'Your district helps agents calculate delivery routes.',
        example: 'e.g., Kinondoni, Ilala, Arusha City'
      });
    }
    if (missingFields.includes('ward')) {
      step3Fields.push({
        name: 'ward', label: 'Ward', placeholder: 'Enter your ward (optional)',
        inputType: 'text', required: false,
        tip: 'More specific location for better agent matching.',
        example: 'e.g., Kijitonyama, Upanga'
      });
    }
    if (missingFields.includes('address')) {
      step3Fields.push({
        name: 'address', label: 'Street Address', placeholder: 'Enter your street address (optional)',
        inputType: 'textarea', required: false,
        tip: 'Your full address for precise delivery locations.',
        example: 'e.g., Plot 123, Samora Avenue, Near Clock Tower'
      });
    }
    if (step3Fields.length > 0) {
      steps.push({
        stepNumber: 3,
        title: 'Where Are You Located?',
        subtitle: 'Your location helps us find the best agents near you.',
        icon: 'fa-solid fa-map-location-dot',
        fields: step3Fields
      });
    }

    return steps;
  }

  /**
   * Pre-fill field values from existing user data
   */
  private prefillFromUser(user: User): void {
    const fields = ['firstname', 'lastname', 'gender', 'phone', 'region', 'district', 'country', 'ward', 'address'];
    for (const field of fields) {
      const value = (user as any)[field];
      if (value) {
        this.fieldValues[field] = String(value);
      }
    }
  }

  // ── Welcome Screen ──────────────────────────────────────────────

  getWelcomeTitle(): string {
    return `Welcome to Pilika-Pilika, ${this.userName}! 👋`;
  }

  getWelcomeMessage(): string {
    const stepCount = this.totalSteps;
    if (this.userRole === 'agent') {
      return `We're thrilled to have you as a delivery partner! To get you started, we just need ${stepCount} quick things about you. The rest you can add anytime in your profile settings. Let's get you set up!`;
    }
    return `Welcome aboard! We're excited to help you ship with confidence. Just ${stepCount} quick steps and you'll be ready to book agents and track deliveries. Let's do this!`;
  }

  getWelcomeBenefits(): { icon: string; title: string; description: string }[] {
    if (this.userRole === 'agent') {
      return [
        { icon: 'fa-solid fa-bolt', title: 'Quick Setup', description: `Just ${this.totalSteps} steps and you're ready to receive bookings` },
        { icon: 'fa-solid fa-gear', title: 'Add More Later', description: 'Pricing, bio, and specialties can be added anytime' },
        { icon: 'fa-solid fa-money-bill-wave', title: 'Start Earning', description: 'Once complete, customers can find and book you' },
      ];
    }
    return [
      { icon: 'fa-solid fa-bolt', title: 'Quick Setup', description: `Just ${this.totalSteps} steps and you're ready to ship` },
      { icon: 'fa-solid fa-truck-fast', title: 'Book Agents', description: 'Find verified logistics agents near your location' },
      { icon: 'fa-solid fa-location-crosshairs', title: 'Track Everything', description: 'Track your shipments from pickup to delivery' },
    ];
  }

  startWizard(): void {
    this.showWelcome = false;
    this.currentStepIndex = 0;
  }

  // ── Field Input & Validation ────────────────────────────────────

  getFieldValue(fieldName: string): string {
    return this.fieldValues[fieldName] || '';
  }

  onFieldInput(fieldName: string, value: string): void {
    this.fieldValues[fieldName] = value;
    if (this.fieldErrors[fieldName]) {
      delete this.fieldErrors[fieldName];
    }
  }

  onFieldBlur(fieldName: string): void {
    this.fieldTouched[fieldName] = true;
    this.validateField(fieldName);
  }

  validateField(fieldName: string): boolean {
    const value = this.fieldValues[fieldName];
    const field = this.findField(fieldName);
    if (!field) return true;

    if (field.required && (!value || value.trim().length === 0)) {
      this.fieldErrors[fieldName] = `${field.label} is required`;
      return false;
    }

    if (fieldName === 'phone' && value && value.trim().length > 0) {
      const phoneRegex = /^[\+]?[\d\s\-\(\)]{8,20}$/;
      if (!phoneRegex.test(value.trim())) {
        this.fieldErrors[fieldName] = 'Please enter a valid phone number';
        return false;
      }
    }

    delete this.fieldErrors[fieldName];
    return true;
  }

  findField(fieldName: string): WizardField | null {
    for (const step of this.steps) {
      const field = step.fields.find(f => f.name === fieldName);
      if (field) return field;
    }
    return null;
  }

  /**
   * Check if all fields in the current step are valid
   */
  isCurrentStepValid(): boolean {
    if (!this.currentStep) return false;
    for (const field of this.currentStep.fields) {
      const value = this.fieldValues[field.name];
      if (field.required && (!value || value.trim().length === 0)) {
        return false;
      }
    }
    return true;
  }

  hasFieldError(fieldName: string): boolean {
    return !!this.fieldErrors[fieldName];
  }

  getFieldError(fieldName: string): string {
    return this.fieldErrors[fieldName] || '';
  }

  // ── Navigation ──────────────────────────────────────────────────

  nextStep(): void {
    if (!this.currentStep) return;

    // Validate all fields in current step
    let hasError = false;
    for (const field of this.currentStep.fields) {
      this.fieldTouched[field.name] = true;
      if (!this.validateField(field.name)) {
        hasError = true;
      }
    }

    if (hasError) return;

    if (this.currentStepIndex < this.totalSteps - 1) {
      this.currentStepIndex++;
    } else {
      // Last step — save everything
      this.saveAllFields();
    }
  }

  prevStep(): void {
    if (this.canGoBack) {
      this.currentStepIndex--;
    }
  }

  // ── Save & Completion ────────────────────────────────────────────

  saveAllFields(): void {
    const updateData: UpdateProfileRequest = {};
    const userFields = ['firstname', 'lastname', 'gender', 'phone', 'region', 'district', 'country', 'ward', 'address'];

    for (const field of userFields) {
      const value = this.fieldValues[field];
      if (value && value.trim().length > 0) {
        (updateData as any)[field] = value.trim();
      }
    }

    const hasData = Object.keys(updateData).length > 0;
    if (!hasData) {
      this.toastService.error('Please fill in at least one field before continuing.');
      return;
    }

    this.isSaving = true;

    this.userService.updateProfile(updateData).subscribe({
      next: (response) => {
        this.isSaving = false;

        if (response.data) {
          this.authService.saveUser(response.data);
        }

        // Check if BASIC profile is complete (essential fields only)
        // Agent-specific fields (pricing, bio, etc.) can be added later
        const basicFields = ['firstname', 'lastname', 'phone', 'region', 'district'];
        const missingBasic = basicFields.filter(f => {
          const value = (response.data as any)?.[f];
          return !value || value === '' || value === null;
        });

        if (missingBasic.length === 0) {
          // Basic profile is complete — mark as done in localStorage
          this.authService.setProfileComplete();
          this.showCompletion = true;
          this.profileUpdated.emit();
        } else {
          // Still missing basic fields
          const remainingLabels = missingBasic.map(f => {
            const field = this.findField(f);
            return field ? field.label : f;
          });
          this.toastService.error(`Please also fill: ${remainingLabels.join(', ')}`);
        }
      },
      error: (err: any) => {
        this.isSaving = false;
        const errorMsg = err.error?.message || 'Failed to save. Please try again.';
        this.toastService.error(errorMsg);
      }
    });
  }

  // ── Completion Actions ───────────────────────────────────────────

  onComplete(): void {
    this.complete.emit();
  }

  onClose(): void {
    this.close.emit();
  }

  // ── UI Helpers ─────────────────────────────────────────────────

  getStepNumber(): string {
    return `${this.currentStepIndex + 1} of ${this.totalSteps}`;
  }

  getProgressBarColor(): string {
    const pct = ((this.currentStepIndex + 1) / this.totalSteps) * 100;
    if (pct < 40) return 'bg-red-500';
    if (pct < 70) return 'bg-orange-500';
    return 'bg-green-500';
  }

  getStepDotColor(index: number): string {
    if (index < this.currentStepIndex) return 'bg-green-500';
    if (index === this.currentStepIndex) return 'bg-orange-500';
    return 'bg-gray-300 dark:bg-gray-600';
  }
}
