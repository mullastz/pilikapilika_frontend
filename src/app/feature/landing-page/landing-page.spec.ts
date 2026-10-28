import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LandingPage } from './landing-page';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { ContentService } from '../../core/services/content.service';

describe('LandingPage', () => {
  let component: LandingPage;
  let fixture: ComponentFixture<LandingPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: () => false, getUser: () => null } },
        { provide: ContentService, useValue: { getContent: () => of({}) } },
        { provide: AgentService, useValue: { getAvailableAgents: () => of({ agents: [
          { id: 42, uuid: 'agent-uuid', firstname: 'Asha', lastname: 'Ali', rating: 4, base_price: null },
        ] }) } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(LandingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders useful fallback copy and crawlable UUID agent links', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toContain('logistics and delivery agents in Tanzania');
    expect(element.querySelector('a[href="/agent/agent-uuid"]')).not.toBeNull();
    expect(element.querySelector('img[fetchpriority="high"]')?.getAttribute('alt')).toBeTruthy();
  });
});
