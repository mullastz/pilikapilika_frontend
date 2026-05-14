import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { Agent, AgentProfileResponse, User, UpdateAgentProfileRequest } from '../../core/interfaces/auth.interface';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-agent-details',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './agent-details.html',
  styleUrl: './agent-details.css',
})
export class AgentDetails implements OnInit {
  agentForm: FormGroup;
  agent: Agent | null = null;
  user: User | null = null;
  isLoading = false;
  isSaving = false;
  isRequestingVerification = false;
  isCancellingVerification = false;
  verificationRequested = false;
  verificationPending = false;
  verificationCancelled = false;

  selectedSpecializations: string[] = [];
  selectedTransport: string[] = [];

  /** Raw numeric strings kept in sync with the formatted inputs */
  basePriceRaw = '';

  currencies = ['TZS', 'USD', 'EUR', 'GBP', 'KES', 'UGX'];

  specializationOptions = [
    'Electronics', 'Fashion', 'Home Appliances', 'Wholesale Sourcing',
    'Documents', 'Food & Beverages', 'Medical Supplies', 'Furniture',
    'Fragile Items', 'Same-Day Delivery',
  ];

  transportOptions = [
    { value: 'air', label: 'Air Freight', icon: 'fa-solid fa-plane' },
    { value: 'sea', label: 'Sea Freight', icon: 'fa-solid fa-ship' },
  ];

  constructor(
    private location: Location,
    private fb: FormBuilder,
    private authService: AuthService,
    private agentService: AgentService,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    private route: ActivatedRoute,
  ) {
    this.agentForm = this.fb.group({
      availability_status: ['available'],
      base_price:           [null, [Validators.required, Validators.min(0)]],
      currency:             ['TZS'],
      avg_delivery_time:    ['',   Validators.maxLength(50)],
      bio:                  ['',   Validators.maxLength(1000)],
      id_number:            ['',   Validators.maxLength(50)],
    });
  }

  ngOnInit(): void {
    this.loadAgentProfile();
  }

  // ── Formatting helpers ──────────────────────────────────────────

  formatWithCommas(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const str = String(value).replace(/,/g, '');
    const num = parseFloat(str);
    if (isNaN(num)) return String(value);
    return num.toLocaleString('en-US');
  }

  onBasePriceInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^0-9]/g, '');
    this.basePriceRaw = raw;
    this.agentForm.get('base_price')?.setValue(raw ? parseFloat(raw) : null, { emitEvent: false });
    input.value = this.formatWithCommas(raw);
    this.cdr.detectChanges();
  }


  // ── Data loading ────────────────────────────────────────────────

  loadAgentProfile(): void {
    this.isLoading = true;
    this.user = this.authService.getUser() as User | null;

    const routeId = this.route.snapshot.paramMap.get('id');
    const userId = routeId ? parseInt(routeId, 10) : this.user?.id;

    if (!userId) {
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.agentService.getAgentProfile(userId).subscribe({
      next: (agent: Agent) => {
        this.agent = agent;
        this.populateForm(agent);
        const hasRequested = !!agent.agent_verification_requested_at;
        const isVerified  = !!agent.agent_verified_at || agent.is_agent_verified;
        this.verificationPending   = hasRequested && !isVerified;
        this.verificationRequested = hasRequested && !isVerified;
        this.verificationCancelled = false;
        this.isLoading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading agent profile:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  requestVerification(): void {
    this.isRequestingVerification = true;
    this.cdr.detectChanges();

    this.agentService.requestVerification().subscribe({
      next: () => {
        this.isRequestingVerification = false;
        this.toastService.success('Verification request submitted! An admin will review your profile.');
        this.loadAgentProfile();
      },
      error: (err) => {
        this.isRequestingVerification = false;
        this.toastService.error(err.error?.message || 'Failed to submit verification request. Please try again.');
        this.cdr.detectChanges();
      },
    });
  }

  cancelVerification(): void {
    this.isCancellingVerification = true;
    this.cdr.detectChanges();

    this.agentService.cancelVerification().subscribe({
      next: () => {
        this.isCancellingVerification = false;
        this.toastService.success('Verification request cancelled successfully.');
        this.loadAgentProfile();
      },
      error: (err) => {
        this.isCancellingVerification = false;
        this.toastService.error(err.error?.message || 'Failed to cancel verification request. Please try again.');
        this.cdr.detectChanges();
      },
    });
  }

  populateForm(agent: any): void {
    const basePriceVal = agent.base_price ?? null;

    // Keep raw strings in sync so the formatted inputs display correctly
    this.basePriceRaw = basePriceVal !== null ? String(basePriceVal).replace(/,/g, '') : '';

    this.agentForm.patchValue({
      availability_status: agent.availability_status || 'available',
      base_price: basePriceVal,
      currency: agent.currency || 'TZS',
      avg_delivery_time: agent.avg_delivery_time || '',
      bio: agent.bio || '',
      id_number: agent.id_number || '',
    });

    this.selectedSpecializations = agent.specializations   || [];
    this.selectedTransport       = agent.transport_methods || [];
  }

  onSubmit(): void {
    if (this.agentForm.invalid) {
      this.agentForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const formValue = this.agentForm.getRawValue();
    const userId    = this.user?.id;

    if (!userId) {
      this.isSaving = false;
      this.toastService.error('User ID not found');
      return;
    }

    const agentUpdateData: UpdateAgentProfileRequest = {
      availability_status: formValue.availability_status,
      base_price: formValue.base_price,
      currency: formValue.currency,
      avg_delivery_time: formValue.avg_delivery_time || null,
      bio: formValue.bio || null,
      id_number: formValue.id_number || null,
      specializations: this.selectedSpecializations,
      transport_methods: this.selectedTransport,
    };

    this.agentService.updateAgentProfile(userId, agentUpdateData).subscribe({
      next: (response: AgentProfileResponse) => {
        this.isSaving = false;
        this.agent = response.data;
        this.user  = response.data;
        this.toastService.success('Agent profile updated successfully!');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.toastService.error(err.error?.message || 'Failed to update agent profile. Please try again.');
        this.cdr.detectChanges();
      },
    });
  }

  goBack(): void { this.location.back(); }

  isSpecializationSelected(spec: string): boolean {
    return this.selectedSpecializations.includes(spec);
  }

  toggleSpecialization(spec: string): void {
    const i = this.selectedSpecializations.indexOf(spec);
    i > -1 ? this.selectedSpecializations.splice(i, 1) : this.selectedSpecializations.push(spec);
  }

  isTransportSelected(v: string): boolean { return this.selectedTransport.includes(v); }

  toggleTransport(v: string): void {
    const i = this.selectedTransport.indexOf(v);
    i > -1 ? this.selectedTransport.splice(i, 1) : this.selectedTransport.push(v);
  }

  get basePrice() { return this.agentForm.get('base_price'); }
}
