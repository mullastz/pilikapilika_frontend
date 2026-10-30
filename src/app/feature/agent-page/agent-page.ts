import { Component, OnInit, ChangeDetectorRef, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { timeout } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { Footer } from '../../shared/footer/footer';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { Agent } from '../../core/interfaces/auth.interface';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';
import { resolveImageUrl } from '../../core/utils/image-url.util';

@Component({
  selector: 'app-agent-page',
  standalone: true,
  imports: [ CommonModule, Footer ],
  templateUrl: './agent-page.html',
  styleUrl: './agent-page.css',
})
export class AgentPage implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  agent: Agent | null = null;
  isLoading = true;
  error: string | null = null;
  profileImageFailed = false;

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
    this.seo.privatePage();
    const id = this.route.snapshot.paramMap.get('id');
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
    this.isLoading = true;
    this.profileImageFailed = false;

    // UUID contains hyphens; numeric IDs do not
    const isUuid = id.includes('-');

    if (isUuid) {
      // Use the public endpoint which already supports UUID lookup
      this.agentService.getPublicAgentProfile(id).pipe(timeout(8000)).subscribe({
        next: (agent: Agent) => {
          this.agent = agent;
          this.updateSeo(agent);
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.error = err.error?.message || 'Failed to load agent profile';
          this.seo.privatePage();
          if (this.isBrowser) this.toastService.error(this.error || 'Failed to load agent profile');
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
      this.agentService.getPublicAgentProfile(numericId).pipe(timeout(8000)).subscribe({
        next: (agent: Agent) => {
          this.agent = agent;
          this.updateSeo(agent);
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.error = err.error?.message || 'Failed to load agent profile';
          this.seo.privatePage();
          if (this.isBrowser) this.toastService.error(this.error || 'Failed to load agent profile');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  getTransportIcon(method: string): string {
    return this.transportIcons[method] || 'fa-solid fa-truck';
  }

  getProfileImage(): string {
    const fallback = 'assets/landingpage_images/defaultprofile.jfif';
    return this.profileImageFailed
      ? fallback
      : resolveImageUrl(this.agent?.profile_photo || this.agent?.image, fallback);
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

  private updateSeo(agent: Agent): void {
    const name = this.getFullName();
    const location = [agent.district, agent.region].filter(Boolean).join(', ') || 'Tanzania';
    this.seo.update({
      title: `${name} | Logistics Agent in ${location} | Pilikapilika`,
      description: `View ${name}'s logistics services in ${location}. Check available services and delivery information on Pilikapilika.`,
      path: `/agent/${encodeURIComponent(agent.uuid || String(agent.id))}`,
      index: true,
    });
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

    this.router.navigate(['/qr-generator']);
  }
}
