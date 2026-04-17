import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { Agent, AgentProfileResponse, User, UpdateAgentProfileRequest } from '../../core/interfaces/auth.interface';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-agent-details',
  imports: [ CommonModule, ReactiveFormsModule, RouterModule ],
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

  specializationOptions = [
    'Electronics',
    'Fashion',
    'Home Appliances',
    'Wholesale Sourcing',
    'Documents',
    'Food & Beverages',
    'Medical Supplies',
    'Furniture',
    'Fragile Items',
    'Same-Day Delivery'
  ];

  transportOptions = [
    { value: 'motorcycle', label: 'Motorcycle', icon: 'fa-solid fa-motorcycle' },
    { value: 'bicycle', label: 'Bicycle', icon: 'fa-solid fa-bicycle' },
    { value: 'car', label: 'Car', icon: 'fa-solid fa-car' },
    { value: 'van', label: 'Van', icon: 'fa-solid fa-van-shuttle' },
    { value: 'truck', label: 'Truck', icon: 'fa-solid fa-truck' },
    { value: 'air', label: 'Air Freight', icon: 'fa-solid fa-plane' },
    { value: 'sea', label: 'Sea Freight', icon: 'fa-solid fa-ship' },
    { value: 'local', label: 'Local Delivery', icon: 'fa-solid fa-person-walking' }
  ];

  constructor(
    private location: Location,
    private fb: FormBuilder,
    private authService: AuthService,
    private agentService: AgentService,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    private route: ActivatedRoute
  ) {
    // Agent-specific form only - personal details in Manage Account
    this.agentForm = this.fb.group({
      availability_status: ['available'],
      base_price: [null, [Validators.required, Validators.min(0)]],
      price_per_km: [null, [Validators.min(0)]],
      max_delivery_distance: [null, [Validators.min(0)]],
      avg_delivery_time: ['', Validators.maxLength(50)],
      bio: ['', Validators.maxLength(1000)],
      id_number: ['', Validators.maxLength(50)],
    });
  }

  ngOnInit(): void {
    this.loadAgentProfile();
  }

  loadAgentProfile(): void {
    this.isLoading = true;
    this.user = this.authService.getUser() as User | null;

    // Get userId from route params or use current user's id for /account/agent
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
        // Check verification status - use user data from agent (which extends User)
        const hasRequested = !!agent.agent_verification_requested_at;
        const isVerified = !!agent.agent_verified_at || agent.is_agent_verified;
        this.verificationPending = hasRequested && !isVerified;
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
      }
    });
  }

  /**
   * Request agent verification from admin
   */
  requestVerification(): void {
    this.isRequestingVerification = true;
    this.cdr.detectChanges();

    this.agentService.requestVerification().subscribe({
      next: (response) => {
        this.isRequestingVerification = false;
        this.toastService.success('Verification request submitted! An admin will review your profile.');
        // Reload profile from backend to get real data
        this.loadAgentProfile();
      },
      error: (err) => {
        this.isRequestingVerification = false;
        const errorMsg = err.error?.message || 'Failed to submit verification request. Please try again.';
        this.toastService.error(errorMsg);
        this.cdr.detectChanges();
        console.error('Error requesting verification:', err);
      }
    });
  }

  /**
   * Cancel agent verification request
   */
  cancelVerification(): void {
    this.isCancellingVerification = true;
    this.cdr.detectChanges();

    this.agentService.cancelVerification().subscribe({
      next: (response) => {
        this.isCancellingVerification = false;
        this.toastService.success('Verification request cancelled successfully.');
        // Reload profile from backend to get real data
        this.loadAgentProfile();
      },
      error: (err) => {
        this.isCancellingVerification = false;
        const errorMsg = err.error?.message || 'Failed to cancel verification request. Please try again.';
        this.toastService.error(errorMsg);
        this.cdr.detectChanges();
        console.error('Error cancelling verification:', err);
      }
    });
  }

  populateForm(agent: any): void {
    this.agentForm.patchValue({
      availability_status: agent.availability_status || 'available',
      base_price: agent.base_price,
      price_per_km: agent.price_per_km,
      max_delivery_distance: agent.max_delivery_distance,
      avg_delivery_time: agent.avg_delivery_time || '',
      bio: agent.bio || '',
      id_number: agent.id_number || '',
    });
    
    // Load specializations and transport methods into selected arrays
    this.selectedSpecializations = agent.specializations || [];
    this.selectedTransport = agent.transport_methods || [];
  }

  onSubmit(): void {
    if (this.agentForm.invalid) {
      this.agentForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;

    const formValue = this.agentForm.getRawValue();
    const userId = this.user?.id;
    
    if (!userId) {
      this.isSaving = false;
      this.toastService.error('User ID not found');
      return;
    }

    const agentUpdateData: UpdateAgentProfileRequest = {
      availability_status: formValue.availability_status,
      base_price: formValue.base_price,
      price_per_km: formValue.price_per_km || null,
      max_delivery_distance: formValue.max_delivery_distance || null,
      avg_delivery_time: formValue.avg_delivery_time || null,
      bio: formValue.bio || null,
      id_number: formValue.id_number || null,
      specializations: this.selectedSpecializations,
      transport_methods: this.selectedTransport,
    };

    // Update agent profile only - personal details in Manage Account
    this.agentService.updateAgentProfile(userId, agentUpdateData).subscribe({
      next: (response: AgentProfileResponse) => {
        this.isSaving = false;
        this.agent = response.data;
        this.user = response.data;
        this.toastService.success('Agent profile updated successfully!');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSaving = false;
        const errorMsg = err.error?.message || 'Failed to update agent profile. Please try again.';
        this.toastService.error(errorMsg);
        this.cdr.detectChanges();
        console.error('Error updating agent profile:', err);
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  // Specialization handling
  isSpecializationSelected(spec: string): boolean {
    return this.selectedSpecializations.includes(spec);
  }

  toggleSpecialization(spec: string): void {
    const index = this.selectedSpecializations.indexOf(spec);
    if (index > -1) {
      this.selectedSpecializations.splice(index, 1);
    } else {
      this.selectedSpecializations.push(spec);
    }
  }

  // Transport handling
  isTransportSelected(transportValue: string): boolean {
    return this.selectedTransport.includes(transportValue);
  }

  toggleTransport(transportValue: string): void {
    const index = this.selectedTransport.indexOf(transportValue);
    if (index > -1) {
      this.selectedTransport.splice(index, 1);
    } else {
      this.selectedTransport.push(transportValue);
    }
  }

  // Getters for form controls
  get basePrice() { return this.agentForm.get('base_price'); }
}
