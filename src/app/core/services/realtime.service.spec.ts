import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { MessagingService } from './messaging.service';
import { RealtimeService } from './realtime.service';
import { environment } from '../../../environments/environment';

describe('RealtimeService production address', () => {
  it('uses the configured WebSocket origin without putting credentials in the URL', () => {
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: {} },
      { provide: MessagingService, useValue: {} },
    ] });
    const service = TestBed.inject(RealtimeService);
    // Exercise URL creation without opening a socket or sending credentials.
    const url = new URL(service['buildWsUrl']());
    expect(url.origin).toBe(new URL(environment.reverbUrl).origin);
    expect(url.pathname).toBe(`/app/${environment.reverbAppKey}`);
    expect(url.searchParams.has('token')).toBe(false);
    expect(url.searchParams.has('user')).toBe(false);
  });
});
