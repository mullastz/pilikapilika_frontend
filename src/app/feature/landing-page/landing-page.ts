import { Component, ElementRef, ViewChild, OnInit, ChangeDetectorRef, signal, inject, PLATFORM_ID, afterNextRender } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { timeout } from 'rxjs';
import { Footer } from '../../shared/footer/footer';
import { Header } from '../../shared/header/header';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { Agent } from '../../core/interfaces/auth.interface';
import { resolveImageUrl } from '../../core/utils/image-url.util';
import { ToastService } from '../../core/services/toast.service';
import { ContentService } from '../../core/services/content.service';

@Component({
  selector: 'app-landing-page',
  imports: [ CommonModule, Footer, Header, RouterLink ],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css'
})

export class LandingPage implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  agentPhoto(agent: Agent): string {
    return resolveImageUrl(agent.profile_photo || agent.image, 'assets/landingpage_images/profile4.jpg');
  }

  @ViewChild('agentsContainer') agentsContainer!: ElementRef;
  @ViewChild('topAgentsContainer') topAgentsContainer!: ElementRef;

  agents: Agent[] = [];
  topAgents: Agent[] = [];
  isLoadingAgents = true;
  showProfilePopup = false;

  heroTitle = signal('Find logistics and delivery agents in Tanzania');
  heroSubtitle = signal('Compare logistics services, book shipments, and follow your delivery updates with Pilikapilika.');
  heroImage = signal('assets/landingpage_images/logistics.webp');
  isLoadingHero = signal(true);

  constructor(
    private router: Router,
    private agentService: AgentService,
    private authService: AuthService,
    private toastService: ToastService,
    private contentService: ContentService,
    private cdr: ChangeDetectorRef
  ) {
    afterNextRender(() => {
      if (this.authService.isAuthenticated()) this.router.navigate(['/home']);
      else this.checkProfileCompletion();
    });
  }

  ngOnInit(): void {
    this.loadAgents();
    this.loadHeroContent();
  }

  loadHeroContent(): void {
    this.contentService.getContent().subscribe((content) => {
      if (content['hero_title']) this.heroTitle.set(content['hero_title']);
      if (content['hero_subtitle']) this.heroSubtitle.set(content['hero_subtitle']);
      if (content['hero_image']) {
        this.heroImage.set(resolveImageUrl(content['hero_image'], 'assets/landingpage_images/logistics.webp'));
      }
      this.isLoadingHero.set(false);
      this.cdr.detectChanges();
    });
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
    this.agentService.getAvailableAgents(1, 10).pipe(timeout(8000)).subscribe({
      next: (response) => {
        this.agents = response.agents;
        // Sort by rating for top agents
        this.topAgents = [...response.agents].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 6);
        this.isLoadingAgents = false;
        this.cdr.detectChanges(); // Trigger change detection
      },
      error: (err: any) => {
        if (this.isBrowser) this.toastService.error('Failed to load agents. Please try again.');
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
    this.router.navigate(['/agent', agentId]).then(
      (success) => { },
      (error) => { }
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
