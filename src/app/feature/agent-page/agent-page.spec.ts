import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgentPage } from './agent-page';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { AgentFollowService } from '../../core/services/agent-follow.service';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';

const DEFAULT_PHOTO = 'assets/landingpage_images/defaultprofile.jfif';

describe('AgentPage', () => {
  let component: AgentPage;
  let fixture: ComponentFixture<AgentPage>;
  const load = vi.fn();
  const isAuthenticated = vi.fn();
  const follows = {
    status: vi.fn(), follow: vi.fn(), unfollow: vi.fn(), rememberInvite: vi.fn(),
  };
  let queryParams: Record<string, string> = {};

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AgentPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '42' }), queryParamMap: convertToParamMap(queryParams) } },
        },
        { provide: AgentService, useValue: { getPublicAgentProfile: load } },
        {
          provide: AuthService,
          useValue: { isAuthenticated, getUser: () => ({ uuid: 'customer-uuid' }), rememberReturnUrl: vi.fn() },
        },
        { provide: AgentFollowService, useValue: follows },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    queryParams = {};
    isAuthenticated.mockReset().mockReturnValue(true);
    follows.status.mockReset().mockReturnValue(of({ data: { following: false } }));
    follows.follow.mockReset().mockReturnValue(of({ data: { following: true } }));
    follows.unfollow.mockReset();
    follows.rememberInvite.mockReset();
    load.mockReset().mockReturnValue(of({
      id: 42, uuid: 'agent-uuid', firstname: 'Asha', lastname: 'Ali', region: 'Arusha', availability_status: 'available',
    }));
  });

  describe('profile', () => {
    beforeEach(create);

    it('describes the loaded agent and canonicalizes numeric URLs to UUIDs', () => {
      expect(component).toBeTruthy();
      expect(TestBed.inject(Title).getTitle()).toContain('Asha Ali');
      expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://pilikapilika.com/agent/agent-uuid/');
      expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('index, follow');
    });

    it('does not index missing or failed public profiles', () => {
      load.mockReturnValue(throwError(() => ({ error: { message: 'Agent not found' } })));
      component.loadAgent('missing-uuid');
      expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, follow');
      expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    });

    it('opens the parcel form with this agent selected from Book Shipment and has no Message button', () => {
      const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.detectChanges();
      const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
      expect(buttons.some(button => button.textContent?.trim() === 'Message')).toBe(false);
      buttons.find(button => button.textContent?.includes('Book Shipment'))!.click();
      expect(navigateByUrl).toHaveBeenCalledWith('/qr-generator?agent=agent-uuid');
    });

    it('still asks signed-out users to sign in before creating a shipment', () => {
      isAuthenticated.mockReturnValue(false);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.bookShipment();
      expect(navigate).toHaveBeenCalledWith(['/sign-in'], { queryParams: { returnUrl: '/qr-generator?agent=agent-uuid' } });
    });

    it.each([
      { profile_photo: 'https://cdn.example.test/profile_photos/agent.jpg', image: 'https://cdn.example.test/agent-image.jpg', expected: 'https://cdn.example.test/profile_photos/agent.jpg' },
      { profile_photo: 'http://localhost:8000/storage/profile_photos/agent.jpg', image: null, expected: `${environment.apiUrl.replace(/\/api\/v1\/?$/, '')}/storage/profile_photos/agent.jpg` },
      { profile_photo: null, image: 'https://cdn.example.test/agent-image.jpg', expected: 'https://cdn.example.test/agent-image.jpg' },
      { profile_photo: null, image: null, expected: DEFAULT_PHOTO },
    ])('renders the correct profile photo: $expected', ({ profile_photo, image, expected }) => {
      load.mockReturnValue(of({ ...component.agent, profile_photo, image }));
      component.loadAgent('3');
      fixture.detectChanges();
      const photo = fixture.nativeElement.querySelector('img') as HTMLImageElement;
      expect(photo.getAttribute('src')).toBe(expected);
      expect(photo.alt).toBe('Asha Ali');
    });

    it('falls back after an image fails and tries the saved photo again when the profile reloads', () => {
      const profilePhoto = 'https://cdn.example.test/profile_photos/agent.jpg';
      load.mockReturnValue(of({ ...component.agent, profile_photo: profilePhoto }));
      component.loadAgent('3');
      fixture.detectChanges();
      const photo = fixture.nativeElement.querySelector('img') as HTMLImageElement;
      photo.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(photo.getAttribute('src')).toBe(DEFAULT_PHOTO);
      component.loadAgent('3');
      fixture.detectChanges();
      expect((fixture.nativeElement.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe(profilePhoto);
    });

    it('offers call, WhatsApp and social buttons from the agent contact channels', () => {
      load.mockReturnValue(of({
        ...component.agent, phone: '0700 000 000', contact_phone: '+255 712 345 678', whatsapp: '+255 787 000 111',
        instagram: 'https://instagram.com/asha.cargo', facebook: 'https://facebook.com/ashacargo',
      }));
      component.loadAgent('3');
      fixture.detectChanges();
      const link = (label: string) => fixture.nativeElement.querySelector(`a[aria-label*="${label}"]`) as HTMLAnchorElement | null;
      expect(link('Call')?.getAttribute('href')).toBe('tel:+255712345678');
      expect(link('WhatsApp')?.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/255787000111\?text=/);
      expect(link('Instagram')?.getAttribute('href')).toBe('https://instagram.com/asha.cargo');
      expect(link('Facebook')?.getAttribute('href')).toBe('https://facebook.com/ashacargo');
    });

    it('never renders social links outside the official https domains', () => {
      load.mockReturnValue(of({ ...component.agent, instagram: 'javascript:alert(1)', facebook: 'https://evil.example/facebook.com/x' }));
      component.loadAgent('3');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('a[aria-label*="Instagram"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('a[aria-label*="Facebook"]')).toBeNull();
    });
  });

  describe('invite links', () => {
    it('follows the agent automatically when a signed-in customer opens the invite link', async () => {
      queryParams = { ref: 'invite' };
      await create();
      expect(follows.follow).toHaveBeenCalledWith('agent-uuid');
    });

    it('remembers the invite for after sign-in when the visitor is signed out', async () => {
      queryParams = { ref: 'invite' };
      isAuthenticated.mockReturnValue(false);
      await create();
      expect(follows.rememberInvite).toHaveBeenCalledWith('agent-uuid');
      expect(follows.follow).not.toHaveBeenCalled();
    });

    it('does not follow automatically from a normal profile visit', async () => {
      await create();
      expect(follows.follow).not.toHaveBeenCalled();
    });
  });
});
