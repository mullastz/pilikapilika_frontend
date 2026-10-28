import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

describe('AuthService during public-page prerendering', () => {
  it('never reads browser credentials while rendering on the server', () => {
    TestBed.configureTestingModule({ providers: [
      { provide: PLATFORM_ID, useValue: 'server' },
      { provide: ApiService, useValue: {} },
    ] });
    const storage = vi.spyOn(Storage.prototype, 'getItem');
    const auth = TestBed.inject(AuthService);
    expect(auth.getToken()).toBeNull();
    expect(auth.getUser()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  });
});
