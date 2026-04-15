import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { User, Agent, UpdateAgentProfileRequest } from '../../core/interfaces/auth.interface';

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
    this.user = this.authService.getUser();

    // Get userId from route params or use current user's id for /account/agent
    const routeId = this.route.snapshot.paramMap.get('id');
    const userId = routeId ? parseInt(routeId, 10) : this.user?.id;

    if (!userId) {
      this.isLoading = false;
      return;
    }

    this.authService.getAgentProfile(userId).subscribe({
      next: (agent) => {
        this.agent = agent;
        this.user = agent; // Agent extends User

        this.selectedSpecializations = agent.specializations || [];
        this.selectedTransport = agent.transport_methods || [];

        this.populateForm(agent);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading agent profile:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
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
    this.authService.updateAgentProfile(userId, agentUpdateData).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.agent = response.data;
        this.user = response.data;
        this.toastService.success('Agent profile updated successfully!');
        this.cdr.detectChanges();
      },
      error: (err) => {
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
