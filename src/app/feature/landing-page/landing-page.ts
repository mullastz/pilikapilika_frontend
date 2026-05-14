import { Component, ElementRef, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Footer } from '../../shared/footer/footer';
import { Header } from '../../shared/header/header';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { Agent } from '../../core/interfaces/auth.interface';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-landing-page',
  imports: [ CommonModule, Footer, Header, RouterLink ],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css'
})

export class LandingPage implements OnInit {
  @ViewChild('agentsContainer') agentsContainer!: ElementRef;
  @ViewChild('topAgentsContainer') topAgentsContainer!: ElementRef;

  agents: Agent[] = [];
  topAgents: Agent[] = [];
  isLoadingAgents = true;
  showProfilePopup = false;

  constructor(
    private router: Router,
    private agentService: AgentService,
    private authService: AuthService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Redirect logged-in users to home page
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
      return;
    }
    this.loadAgents();
    this.checkProfileCompletion();
  }

  checkProfileCompletion(): void {
    if (this.authService.isAuthenticated() && this.authService.needsProfileCompletion()) {
      this.showProfilePopup = true;
    }
  }

  goToProfile(): void {
    this.showProfilePopup = false;
    this.router.navigate(['/account/details']);
  }

  closeProfilePopup(): void {
    this.showProfilePopup = false;
  }

  loadAgents(): void {
    this.isLoadingAgents = true;
    console.log('Loading agents...');
    this.agentService.getAvailableAgents().subscribe({
      next: (agents: Agent[]) => {
        console.log('Agents loaded:', agents);
        this.agents = agents;
        // Sort by rating for top agents
        this.topAgents = [...agents].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 6);
        this.isLoadingAgents = false;
        this.cdr.detectChanges(); // Trigger change detection
      },
      error: (err: any) => {
        console.error('Error loading agents:', err);
        this.toastService.error('Failed to load agents. Please try again.');
        this.isLoadingAgents = false;
        this.agents = [];
        this.topAgents = [];
        this.cdr.detectChanges(); // Trigger change detection
      }
    });
  }

  goTo(route: string): void {
    this.router.navigate([route]);
  }

  viewAgentProfile(agentId: number): void {
    console.log('Navigating to agent profile:', agentId);
    this.router.navigate(['/agent', agentId]).then(
      (success) => console.log('Navigation result:', success),
      (error) => console.error('Navigation error:', error)
    );
  }

  trackByAgentId(index: number, agent: Agent): number {
    return agent.id;
  }

activities = [
  { icon: 'fa-solid fa-qrcode', label: 'Generate QRcode', route: '/qr-generator' },
  { icon: 'fa-solid fa-magnifying-glass', label: 'Search Agent', route: '/search' },
  { icon: 'fa-solid fa-location-crosshairs', label: 'Track Shipping', route: '/account/shipping' }
];

testimonials = [
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },  
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },  
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },  
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },  
  {
    name: 'Andra',
    city: 'Dar-es-salaam',
    message: 'The tracking updates gave me full confidence.',
    avatar: 'assets/landingpage_images/profile1.webp'
  },
];

scrollLeft(containerId: string) {
  const container = containerId === 'topAgentsContainer' 
    ? this.topAgentsContainer 
    : this.agentsContainer;

  if (container?.nativeElement) {
    container.nativeElement.scrollBy({
      left: -320,
      behavior: 'smooth'
    });
  }
}

scrollRight(containerId: string) {
  const container = containerId === 'topAgentsContainer' 
    ? this.topAgentsContainer 
    : this.agentsContainer;

  if (container?.nativeElement) {
    container.nativeElement.scrollBy({
      left: 320,
      behavior: 'smooth'
    });
  }
}
}
