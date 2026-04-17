import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Footer } from '../../shared/footer/footer';
import { AgentService } from '../../core/services/agent.service';
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
    private location: Location,
    private agentService: AgentService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('AgentPage ngOnInit');
    const id = this.route.snapshot.paramMap.get('id');
    console.log('Agent ID from route:', id);
    if (id) {
      this.loadAgent(+id);
    } else {
      this.error = 'No agent ID provided';
      this.isLoading = false;
    }
  }

  goBack(): void {
    this.location.back();
  }

  loadAgent(id: number): void {
    console.log('Loading agent:', id);
    this.isLoading = true;
    this.agentService.getPublicAgentProfile(id).subscribe({
      next: (agent: Agent) => {
        console.log('Agent loaded successfully:', agent);
        this.agent = agent;
        this.isLoading = false;
        this.cdr.detectChanges(); // Trigger change detection
      },
      error: (err: any) => {
        console.error('Error loading agent:', err);
        this.error = err.error?.message || 'Failed to load agent profile';
        this.toastService.error(this.error || 'Failed to load agent profile');
        this.isLoading = false;
        this.cdr.detectChanges(); // Trigger change detection
      }
    });
  }

  getTransportIcon(method: string): string {
    return this.transportIcons[method] || 'fa-solid fa-truck';
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
}
