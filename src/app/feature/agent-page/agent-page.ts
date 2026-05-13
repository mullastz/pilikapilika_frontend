import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Footer } from '../../shared/footer/footer';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { Agent } from '../../core/interfaces/auth.interface';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-agent-page',
  standalone: true,
  imports: [ CommonModule, Footer ],
  templateUrl: './agent-page.html',
  styleUrl: './agent-page.css',
})
export class AgentPage implements OnInit {
  agent: Agent | null = null;
  isLoading = true;
  error: string | null = null;

  // Transport method icons mapping
  transportIcons: { [key: string]: string } = {
    'air': 'fa-solid fa-plane',
    'sea': 'fa-solid fa-ship',
    'road': 'fa-solid fa-truck',
    'express': 'fa-solid fa-bolt',
    'rail': 'fa-solid fa-train'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private agentService: AgentService,
    private authService: AuthService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('AgentPage ngOnInit');
    const id = this.route.snapshot.paramMap.get('id');
    console.log('Agent ID from route:', id);
    if (id) {
      this.loadAgent(id);
    } else {
      this.error = 'No agent ID provided';
      this.isLoading = false;
    }
  }

  goBack(): void {
    window.history.back();
  }

  loadAgent(id: string): void {
    console.log('Loading agent:', id);
    this.isLoading = true;

    // UUID contains hyphens; numeric IDs do not
    const isUuid = id.includes('-');

    if (isUuid) {
      // Use the public endpoint which already supports UUID lookup
      this.agentService.getPublicAgentProfile(id as any).subscribe({
        next: (agent: Agent) => {
          console.log('Agent loaded successfully:', agent);
          this.agent = agent;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Error loading agent:', err);
          this.error = err.error?.message || 'Failed to load agent profile';
          this.toastService.error(this.error || 'Failed to load agent profile');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        this.error = 'Invalid agent ID';
        this.isLoading = false;
        return;
      }
      this.agentService.getPublicAgentProfile(numericId).subscribe({
        next: (agent: Agent) => {
          console.log('Agent loaded successfully:', agent);
          this.agent = agent;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Error loading agent:', err);
          this.error = err.error?.message || 'Failed to load agent profile';
          this.toastService.error(this.error || 'Failed to load agent profile');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  getTransportIcon(method: string): string {
    return this.transportIcons[method] || 'fa-solid fa-truck';
  }

  formatWithCommas(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return value.toLocaleString('en-US');
  }

  formatPrice(value: number | null | undefined, currency: string | null | undefined): string {
    if (value === null || value === undefined) return 'Contact';
    const cur = currency || 'TZS';
    return `${cur} ${this.formatWithCommas(value)}`;
  }

  getFullName(): string {
    if (!this.agent) return '';
    return `${this.agent.firstname || ''} ${this.agent.lastname || ''}`.trim() || 'Unknown Agent';
  }

  getLocation(): string {
    if (!this.agent) return '';
    const region = this.agent.region || '';
    const district = this.agent.district || '';
    if (region && district) return `${region}, ${district}`;
    return region || district || 'Unknown Location';
  }

  startConversation(): void {
    if (!this.agent) {
      this.toastService.error('Agent information not available');
      return;
    }

    console.log('Starting conversation with agent:', this.agent);
    
    // Navigate to messages page with agent information as query parameters
    this.router.navigate(['/messages'], {
      queryParams: {
        userId: this.agent.uuid || this.agent.id.toString(),
        name: this.getFullName()
      }
    });
  }

  bookShipment(): void {
    if (!this.agent) {
      this.toastService.error('Agent information not available');
      return;
    }

    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      this.toastService.error('Please login to book a shipment');
      this.router.navigate(['/sign-in'], { 
        queryParams: { returnUrl: this.router.url } 
      });
      return;
    }

    // Navigate to book shipment page with agent ID
    const agentId = this.agent.uuid || this.agent.id.toString();
    this.router.navigate(['/book-shipment', agentId]);
  }
}
