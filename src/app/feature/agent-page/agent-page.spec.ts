import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgentPage } from './agent-page';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

describe('AgentPage', () => {
  let component: AgentPage;
  let fixture: ComponentFixture<AgentPage>;
  const load = vi.fn();
  const isAuthenticated = vi.fn();

  beforeEach(async () => {
    isAuthenticated.mockReset().mockReturnValue(true);
    load.mockReset().mockReturnValue(of({ id: 42, uuid: 'agent-uuid', firstname: 'Asha', lastname: 'Ali', region: 'Arusha' }));
    await TestBed.configureTestingModule({
      imports: [AgentPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '42' }) } } },
        { provide: AgentService, useValue: { getPublicAgentProfile: load } },
        { provide: AuthService, useValue: { isAuthenticated } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

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

  it('opens the QR code generator from Book Shipment and has no Message button', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.some(button => button.textContent?.trim() === 'Message')).toBe(false);
    buttons.find(button => button.textContent?.trim() === 'Book Shipment')!.click();
    expect(navigate).toHaveBeenCalledWith(['/qr-generator']);
  });

  it('still asks signed-out users to sign in before creating a shipment', () => {
    isAuthenticated.mockReturnValue(false);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.bookShipment();
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], { queryParams: { returnUrl: router.url } });
    expect(navigate).not.toHaveBeenCalledWith(['/qr-generator']);
  });

  it.each([
    { profile_photo: 'https://cdn.example.test/profile_photos/agent.jpg', image: 'https://cdn.example.test/agent-image.jpg', expected: 'https://cdn.example.test/profile_photos/agent.jpg' },
    { profile_photo: 'http://localhost:8000/storage/profile_photos/agent.jpg', image: null, expected: `${environment.apiUrl.replace(/\/api\/v1\/?$/, '')}/storage/profile_photos/agent.jpg` },
    { profile_photo: null, image: 'https://cdn.example.test/agent-image.jpg', expected: 'https://cdn.example.test/agent-image.jpg' },
    { profile_photo: null, image: null, expected: 'assets/landingpage_images/profile4.jpg' },
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
    expect(photo.getAttribute('src')).toBe('assets/landingpage_images/profile4.jpg');
    component.loadAgent('3');
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe(profilePhoto);
  });
});
